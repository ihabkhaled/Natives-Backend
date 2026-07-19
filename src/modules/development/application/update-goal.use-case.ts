import type { AuthUserIdentity } from '@core/auth';
import { CLOCK_PORT, type ClockPort } from '@core/clock/clock.port';
import {
  ID_GENERATOR_PORT,
  type IdGeneratorPort,
} from '@core/id-generator/id-generator.port';
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

import { assertGoalContent } from '../domain/goal.policy';
import { GoalVersionConflictError } from '../errors/goal-version-conflict.error';
import { DevelopmentGoalRepository } from '../infrastructure/development-goal.repository';
import {
  buildActionRows,
  buildGoalAudit,
  buildGoalUpdatedEvent,
} from '../lib/goal.builders';
import { GOAL_UPDATED_ACTION } from '../model/development.constants';
import type {
  DevelopmentGoal,
  DevelopmentGoalDetail,
  UpdateGoalCommand,
} from '../model/goal.types';
import { GoalLookupService } from './goal-lookup.service';

/**
 * Updates a goal's content and replaces its action-plan steps under optimistic
 * concurrency. Validates the new content (null-not-zero numerics), then writes
 * the goal, swaps the action steps, records an audit entry, and enqueues a
 * privacy-safe `development.goal.updated` event — all in one transaction.
 */
@Injectable()
export class UpdateGoalUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR_PORT) private readonly idGenerator: IdGeneratorPort,
    private readonly lookup: GoalLookupService,
    private readonly repository: DevelopmentGoalRepository,
    private readonly audit: AuditRecorderService,
    private readonly events: RecordDomainEventService,
  ) {}

  execute(
    actor: AuthUserIdentity,
    teamId: string,
    goalId: string,
    command: UpdateGoalCommand,
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
    command: UpdateGoalCommand,
  ): Promise<DevelopmentGoalDetail> {
    await this.lookup.requireForWrite(tx, teamId, goalId);
    assertGoalContent(command.content);
    const updated = await this.persist(tx, teamId, goalId, command);
    return this.finish(tx, actor, updated, command);
  }

  private async persist(
    tx: TransactionScope,
    teamId: string,
    goalId: string,
    command: UpdateGoalCommand,
  ): Promise<DevelopmentGoal> {
    const updated = await this.repository.updateContent(tx, {
      id: goalId,
      teamId,
      expectedRecordVersion: command.expectedRecordVersion,
      content: command.content,
      now: this.clock.now(),
    });
    if (updated === null) {
      throw new GoalVersionConflictError();
    }
    return updated;
  }

  private async finish(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    goal: DevelopmentGoal,
    command: UpdateGoalCommand,
  ): Promise<DevelopmentGoalDetail> {
    await this.repository.clearActions(tx, goal.id);
    await this.repository.insertActions(
      tx,
      buildActionRows(
        goal.id,
        command.content.actions,
        () => this.idGenerator.generate(),
        this.clock.now(),
      ),
    );
    await this.audit.record(
      tx,
      buildGoalAudit(GOAL_UPDATED_ACTION, actor.userId, goal),
    );
    await this.events.enqueue(tx, buildGoalUpdatedEvent(goal, actor.userId));
    return { goal, actions: await this.repository.findActions(tx, goal.id) };
  }
}
