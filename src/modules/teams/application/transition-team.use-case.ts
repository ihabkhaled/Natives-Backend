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
import { Inject, Injectable } from '@nestjs/common';

import { canTransitionTeam } from '../domain/team-lifecycle.state-machine';
import { OptimisticConflictError } from '../errors/optimistic-conflict.error';
import { TeamInvalidTransitionError } from '../errors/team-invalid-transition.error';
import { TeamNotFoundError } from '../errors/team-not-found.error';
import { TeamRepository } from '../infrastructure/team.repository';
import { TeamAuditRepository } from '../infrastructure/team-audit.repository';
import { TEAM_TRANSITIONED_EVENT } from '../model/teams.constants';
import type { TeamStatus } from '../model/teams.enums';
import type {
  NewAuditEvent,
  Team,
  TeamStatusChange,
  TransitionCommand,
} from '../model/teams.types';

/**
 * Applies a lifecycle transition (activate / deactivate / archive) to a team:
 * validates the move against the pure state machine, writes it under optimistic
 * concurrency, and audits it — all in one transaction. Status changes are soft:
 * every historical row a team owns is preserved in every state.
 */
@Injectable()
export class TransitionTeamUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR_PORT) private readonly idGenerator: IdGeneratorPort,
    private readonly teams: TeamRepository,
    private readonly audit: TeamAuditRepository,
  ) {}

  execute(
    actor: AuthUserIdentity,
    teamId: string,
    target: TeamStatus,
    command: TransitionCommand,
  ): Promise<Team> {
    return this.unitOfWork.runInTransaction(scope =>
      this.run(scope, actor, teamId, target, command),
    );
  }

  private async run(
    scope: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    target: TeamStatus,
    command: TransitionCommand,
  ): Promise<Team> {
    const current = await this.teams.findById(scope, teamId);
    if (current === null) {
      throw new TeamNotFoundError();
    }
    if (!canTransitionTeam(current.status, target)) {
      throw new TeamInvalidTransitionError();
    }
    const now = this.clock.now();
    const updated = await this.apply(
      scope,
      this.buildChange(teamId, target, actor, command, now),
    );
    await this.audit.append(
      scope,
      this.buildAudit(actor, current.status, updated, now),
    );
    return updated;
  }

  private buildChange(
    teamId: string,
    target: TeamStatus,
    actor: AuthUserIdentity,
    command: TransitionCommand,
    now: Date,
  ): TeamStatusChange {
    return {
      id: teamId,
      status: target,
      updatedBy: actor.userId,
      expectedVersion: command.expectedVersion,
      now,
    };
  }

  private async apply(
    scope: TransactionScope,
    change: TeamStatusChange,
  ): Promise<Team> {
    const updated = await this.teams.applyStatusChange(scope, change);
    if (updated === null) {
      throw new OptimisticConflictError();
    }
    return updated;
  }

  private buildAudit(
    actor: AuthUserIdentity,
    from: TeamStatus,
    team: Team,
    now: Date,
  ): NewAuditEvent {
    return {
      id: this.idGenerator.generate(),
      eventType: TEAM_TRANSITIONED_EVENT,
      actorUserId: actor.userId,
      context: { teamId: team.id, from, to: team.status },
      occurredAt: now,
    };
  }
}
