import type { AuthUserIdentity } from '@core/auth';
import { CLOCK_PORT, type ClockPort } from '@core/clock/clock.port';
import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import {
  AuditRecorderService,
  RecordDomainEventService,
} from '@modules/platform';
import { Inject, Injectable } from '@nestjs/common';

import { GoalVersionConflictError } from '../errors/goal-version-conflict.error';
import { DevelopmentGoalRepository } from '../infrastructure/development-goal.repository';
import { buildGoalAudit, buildGoalUpdatedEvent } from '../lib/goal.builders';
import { GOAL_UPDATED_ACTION } from '../model/development.constants';
import type {
  DevelopmentGoal,
  DevelopmentGoalDetail,
  ReviewGoalCommand,
} from '../model/goal.types';
import { GoalLookupService } from './goal-lookup.service';

/**
 * Records a coach review of a goal: a review note plus fresh progress/evidence
 * (null-not-zero — an unmeasured progress stays NULL). Applies the write under
 * optimistic concurrency, audits it, and enqueues a privacy-safe
 * `development.goal.updated` event in one transaction.
 */
@Injectable()
export class ReviewGoalUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    private readonly lookup: GoalLookupService,
    private readonly repository: DevelopmentGoalRepository,
    private readonly audit: AuditRecorderService,
    private readonly events: RecordDomainEventService,
  ) {}

  execute(
    actor: AuthUserIdentity,
    teamId: string,
    goalId: string,
    command: ReviewGoalCommand,
  ): Promise<DevelopmentGoalDetail> {
    return this.unitOfWork.runInTransaction(tx =>
      this.run(tx, actor, teamId, goalId, command),
    );
  }

  private async run(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    goalId: string,
    command: ReviewGoalCommand,
  ): Promise<DevelopmentGoalDetail> {
    await this.lookup.requireForWrite(tx, teamId, goalId);
    const reviewed = await this.persist(tx, actor, teamId, goalId, command);
    return this.finish(tx, actor, reviewed);
  }

  private async persist(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    goalId: string,
    command: ReviewGoalCommand,
  ): Promise<DevelopmentGoal> {
    const reviewed = await this.repository.applyReview(tx, {
      id: goalId,
      teamId,
      expectedRecordVersion: command.expectedRecordVersion,
      reviewNote: command.reviewNote,
      progressValue: command.progressValue,
      progressNote: command.progressNote,
      evidence: command.evidence,
      reviewedBy: actor.userId,
      now: this.clock.now(),
    });
    if (reviewed === null) {
      throw new GoalVersionConflictError();
    }
    return reviewed;
  }

  private async finish(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    goal: DevelopmentGoal,
  ): Promise<DevelopmentGoalDetail> {
    await this.audit.record(
      tx,
      buildGoalAudit(GOAL_UPDATED_ACTION, actor.userId, goal),
    );
    await this.events.enqueue(tx, buildGoalUpdatedEvent(goal, actor.userId));
    return { goal, actions: await this.repository.findActions(tx, goal.id) };
  }
}
