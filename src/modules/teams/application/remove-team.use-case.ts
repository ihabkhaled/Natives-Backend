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

import { canRemoveTeam } from '../domain/team-lifecycle.state-machine';
import { OptimisticConflictError } from '../errors/optimistic-conflict.error';
import { TeamInvalidTransitionError } from '../errors/team-invalid-transition.error';
import { TeamNotFoundError } from '../errors/team-not-found.error';
import { TeamRepository } from '../infrastructure/team.repository';
import { TeamAuditRepository } from '../infrastructure/team-audit.repository';
import { TEAM_REMOVED_EVENT } from '../model/teams.constants';
import type {
  NewAuditEvent,
  Team,
  TeamRemoval,
  TransitionCommand,
} from '../model/teams.types';

/**
 * Soft-removes a team: stamps `deleted_at` so the team disappears from every
 * read while every historical row it owns stays referentially valid. This is the
 * only "delete" a team has — there is no hard delete. Removal is permitted only
 * from the archived end-state, so an operating team can never be removed by one
 * call, and it is a platform-scoped operation, never a team administrator's.
 */
@Injectable()
export class RemoveTeamUseCase {
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
    command: TransitionCommand,
  ): Promise<Team> {
    return this.unitOfWork.runInTransaction(scope =>
      this.run(scope, actor, teamId, command),
    );
  }

  private async run(
    scope: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    command: TransitionCommand,
  ): Promise<Team> {
    const current = await this.teams.findById(scope, teamId);
    if (current === null) {
      throw new TeamNotFoundError();
    }
    if (!canRemoveTeam(current.status, current.deletedAt)) {
      throw new TeamInvalidTransitionError();
    }
    const now = this.clock.now();
    const removed = await this.apply(
      scope,
      this.buildRemoval(teamId, actor, command, now),
    );
    await this.audit.append(scope, this.buildAudit(actor, removed, now));
    return removed;
  }

  private buildRemoval(
    teamId: string,
    actor: AuthUserIdentity,
    command: TransitionCommand,
    now: Date,
  ): TeamRemoval {
    return {
      id: teamId,
      updatedBy: actor.userId,
      expectedVersion: command.expectedVersion,
      now,
    };
  }

  private async apply(
    scope: TransactionScope,
    removal: TeamRemoval,
  ): Promise<Team> {
    const removed = await this.teams.softRemove(scope, removal);
    if (removed === null) {
      throw new OptimisticConflictError();
    }
    return removed;
  }

  private buildAudit(
    actor: AuthUserIdentity,
    team: Team,
    now: Date,
  ): NewAuditEvent {
    return {
      id: this.idGenerator.generate(),
      eventType: TEAM_REMOVED_EVENT,
      actorUserId: actor.userId,
      context: { teamId: team.id, status: team.status },
      occurredAt: now,
    };
  }
}
