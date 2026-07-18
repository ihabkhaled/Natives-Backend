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

import { SlugConflictError } from '../errors/slug-conflict.error';
import { TeamRepository } from '../infrastructure/team.repository';
import { TeamAuditRepository } from '../infrastructure/team-audit.repository';
import {
  DEFAULT_LOCALE,
  DEFAULT_TIMEZONE,
  TEAM_CREATED_EVENT,
} from '../model/teams.constants';
import type {
  CreateTeamCommand,
  NewAuditEvent,
  NewTeam,
  Team,
} from '../model/teams.types';

/**
 * Creates a team. Enforces slug uniqueness, stamps the creating actor, and
 * appends an audit event — all in one transaction. Only a principal holding
 * team.settings.manage globally (a system admin) passes the guard, since a new
 * team has no prior scope to grant a scoped assignment against.
 */
@Injectable()
export class CreateTeamUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR_PORT) private readonly idGenerator: IdGeneratorPort,
    private readonly teams: TeamRepository,
    private readonly audit: TeamAuditRepository,
  ) {}

  execute(actor: AuthUserIdentity, command: CreateTeamCommand): Promise<Team> {
    return this.unitOfWork.runInTransaction(scope =>
      this.run(scope, actor, command),
    );
  }

  private async run(
    scope: TransactionScope,
    actor: AuthUserIdentity,
    command: CreateTeamCommand,
  ): Promise<Team> {
    if (await this.teams.existsBySlug(scope, command.slug)) {
      throw new SlugConflictError();
    }
    const now = this.clock.now();
    const team = await this.teams.insert(
      scope,
      this.buildTeam(command, actor, now),
    );
    await this.audit.append(scope, this.buildAudit(actor, team, now));
    return team;
  }

  private buildTeam(
    command: CreateTeamCommand,
    actor: AuthUserIdentity,
    now: Date,
  ): NewTeam {
    return {
      id: this.idGenerator.generate(),
      slug: command.slug,
      name: command.name,
      locale: command.locale ?? DEFAULT_LOCALE,
      timezone: command.timezone ?? DEFAULT_TIMEZONE,
      primaryColor: command.primaryColor,
      logoMediaKey: command.logoMediaKey,
      createdBy: actor.userId,
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
      eventType: TEAM_CREATED_EVENT,
      actorUserId: actor.userId,
      context: { teamId: team.id, slug: team.slug },
      occurredAt: now,
    };
  }
}
