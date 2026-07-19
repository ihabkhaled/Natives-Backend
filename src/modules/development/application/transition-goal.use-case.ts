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

import {
  canTransitionGoal,
  isGoalCompletion,
  resolveGoalTarget,
} from '../domain/goal.state-machine';
import { GoalInvalidTransitionError } from '../errors/goal-invalid-transition.error';
import { GoalVersionConflictError } from '../errors/goal-version-conflict.error';
import { DevelopmentGoalRepository } from '../infrastructure/development-goal.repository';
import { buildGoalAudit, buildGoalUpdatedEvent } from '../lib/goal.builders';
import { GOAL_TRANSITIONED_ACTION } from '../model/development.constants';
import type { GoalStatus } from '../model/goal.enums';
import type {
  DevelopmentGoal,
  DevelopmentGoalDetail,
  TransitionGoalCommand,
} from '../model/goal.types';
import { GoalLookupService } from './goal-lookup.service';

/**
 * Moves a goal through its lifecycle (activate/achieve/miss/cancel/reopen) under
 * optimistic concurrency. Rejects an illegal transition and stamps a completion
 * instant only when the goal is achieved. Records an audit entry and a privacy-safe
 * `development.goal.updated` event in one transaction.
 */
@Injectable()
export class TransitionGoalUseCase {
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
    command: TransitionGoalCommand,
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
    command: TransitionGoalCommand,
  ): Promise<DevelopmentGoalDetail> {
    const current = await this.lookup.requireForWrite(tx, teamId, goalId);
    const target = resolveGoalTarget(command.transition);
    if (!canTransitionGoal(current.status, target)) {
      throw new GoalInvalidTransitionError();
    }
    const changed = await this.persist(tx, teamId, goalId, target, command);
    return this.finish(tx, actor, changed);
  }

  private async persist(
    tx: TransactionScope,
    teamId: string,
    goalId: string,
    target: GoalStatus,
    command: TransitionGoalCommand,
  ): Promise<DevelopmentGoal> {
    const now = this.clock.now();
    const changed = await this.repository.applyStatusChange(tx, {
      id: goalId,
      teamId,
      toStatus: target,
      expectedRecordVersion: command.expectedRecordVersion,
      completedAt: isGoalCompletion(target) ? now : null,
      now,
    });
    if (changed === null) {
      throw new GoalVersionConflictError();
    }
    return changed;
  }

  private async finish(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    goal: DevelopmentGoal,
  ): Promise<DevelopmentGoalDetail> {
    await this.audit.record(
      tx,
      buildGoalAudit(GOAL_TRANSITIONED_ACTION, actor.userId, goal),
    );
    await this.events.enqueue(tx, buildGoalUpdatedEvent(goal, actor.userId));
    return { goal, actions: await this.repository.findActions(tx, goal.id) };
  }
}
