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

import { canAcceptTeamWork } from '../domain/team-lifecycle.state-machine';
import { OptimisticConflictError } from '../errors/optimistic-conflict.error';
import { TeamNotFoundError } from '../errors/team-not-found.error';
import { TeamRepository } from '../infrastructure/team.repository';
import { TeamAuditRepository } from '../infrastructure/team-audit.repository';
import {
  DEFAULT_LOCALE,
  DEFAULT_TIMEZONE,
  TEAM_UPDATED_EVENT,
} from '../model/teams.constants';
import type {
  NewAuditEvent,
  Team,
  TeamUpdate,
  UpdateTeamCommand,
} from '../model/teams.types';

/**
 * Updates a team's descriptive fields under optimistic concurrency. A stale or
 * missing expected version raises a version-conflict; an archived or unknown team
 * raises not-found. Records an audit event in the same transaction.
 */
@Injectable()
export class UpdateTeamUseCase {
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
    command: UpdateTeamCommand,
  ): Promise<Team> {
    return this.unitOfWork.runInTransaction(scope =>
      this.run(scope, actor, teamId, command),
    );
  }

  private async run(
    scope: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    command: UpdateTeamCommand,
  ): Promise<Team> {
    const existing = await this.teams.findById(scope, teamId);
    if (
      existing === null ||
      !canAcceptTeamWork(existing.status, existing.deletedAt)
    ) {
      throw new TeamNotFoundError();
    }
    const now = this.clock.now();
    const updated = await this.teams.update(
      scope,
      this.buildUpdate(teamId, command, actor, now),
    );
    if (updated === null) {
      throw new OptimisticConflictError();
    }
    await this.audit.append(scope, this.buildAudit(actor, updated, now));
    return updated;
  }

  private buildUpdate(
    teamId: string,
    command: UpdateTeamCommand,
    actor: AuthUserIdentity,
    now: Date,
  ): TeamUpdate {
    return {
      id: teamId,
      name: command.name,
      locale: command.locale ?? DEFAULT_LOCALE,
      timezone: command.timezone ?? DEFAULT_TIMEZONE,
      primaryColor: command.primaryColor,
      logoMediaKey: command.logoMediaKey,
      updatedBy: actor.userId,
      expectedVersion: command.expectedVersion,
      now,
    };
  }

  private buildAudit(
    actor: AuthUserIdentity,
    team: Team,
    now: Date,
  ): NewAuditEvent {
    return {
      id: this.idGenerator.generate(),
      eventType: TEAM_UPDATED_EVENT,
      actorUserId: actor.userId,
      context: { teamId: team.id, version: team.version },
      occurredAt: now,
    };
  }
}
