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
import { DevelopmentGoalRepository } from '../infrastructure/development-goal.repository';
import {
  buildActionRows,
  buildGoalAudit,
  buildGoalCreatedEvent,
  buildNewGoal,
} from '../lib/goal.builders';
import { GOAL_CREATED_ACTION } from '../model/development.constants';
import type {
  CreateGoalCommand,
  DevelopmentGoal,
  DevelopmentGoalDetail,
} from '../model/goal.types';
import { DevelopmentScopeService } from './development-scope.service';

/**
 * Creates a PROPOSED development goal with its action-plan steps. Validates
 * team/season/membership scope and the goal content (null-not-zero numerics),
 * then writes the goal, its actions, an audit entry, and a `development.goal.created`
 * event in one transaction.
 */
@Injectable()
export class CreateGoalUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR_PORT) private readonly idGenerator: IdGeneratorPort,
    private readonly scope: DevelopmentScopeService,
    private readonly repository: DevelopmentGoalRepository,
    private readonly audit: AuditRecorderService,
    private readonly events: RecordDomainEventService,
  ) {}

  execute(
    actor: AuthUserIdentity,
    teamId: string,
    command: CreateGoalCommand,
  ): Promise<DevelopmentGoalDetail> {
    return this.unitOfWork.runInTransaction(tx =>
      this.run(tx, actor, teamId, command),
    );
  }

  private async run(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    command: CreateGoalCommand,
  ): Promise<DevelopmentGoalDetail> {
    await this.scope.validate(tx, teamId, command.seasonId);
    await this.scope.requireMembership(tx, teamId, command.membershipId);
    assertGoalContent(command.content);
    const goal = await this.persist(tx, actor, teamId, command);
    return this.finish(tx, actor, goal, command);
  }

  private persist(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    command: CreateGoalCommand,
  ): Promise<DevelopmentGoal> {
    return this.repository.insertGoal(
      tx,
      buildNewGoal(
        this.idGenerator.generate(),
        teamId,
        command,
        actor.userId,
        this.clock.now(),
      ),
    );
  }

  private async finish(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    goal: DevelopmentGoal,
    command: CreateGoalCommand,
  ): Promise<DevelopmentGoalDetail> {
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
      buildGoalAudit(GOAL_CREATED_ACTION, actor.userId, goal),
    );
    await this.events.enqueue(tx, buildGoalCreatedEvent(goal));
    return { goal, actions: await this.repository.findActions(tx, goal.id) };
  }
}
