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

import { TeamNotFoundError } from '../errors/team-not-found.error';
import { TeamRepository } from '../infrastructure/team.repository';
import { TeamAuditRepository } from '../infrastructure/team-audit.repository';
import { TEAM_ARCHIVED_EVENT } from '../model/teams.constants';
import { ResourceStatus } from '../model/teams.enums';
import type { NewAuditEvent, Team } from '../model/teams.types';

/**
 * Archives a team (soft, reversible-by-migration lifecycle change). Historical
 * reference data is preserved, never deleted. Idempotency is not implied: a
 * second archive of an already-archived team raises not-found.
 */
@Injectable()
export class ArchiveTeamUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR_PORT) private readonly idGenerator: IdGeneratorPort,
    private readonly teams: TeamRepository,
    private readonly audit: TeamAuditRepository,
  ) {}

  execute(actor: AuthUserIdentity, teamId: string): Promise<Team> {
    return this.unitOfWork.runInTransaction(scope =>
      this.run(scope, actor, teamId),
    );
  }

  private async run(
    scope: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
  ): Promise<Team> {
    const existing = await this.teams.findById(scope, teamId);
    if (existing === null || existing.status === ResourceStatus.Archived) {
      throw new TeamNotFoundError();
    }
    const now = this.clock.now();
    const archived = await this.teams.archive(scope, teamId, actor.userId, now);
    if (archived === null) {
      throw new TeamNotFoundError();
    }
    await this.audit.append(scope, this.buildAudit(actor, archived, now));
    return archived;
  }

  private buildAudit(
    actor: AuthUserIdentity,
    team: Team,
    now: Date,
  ): NewAuditEvent {
    return {
      id: this.idGenerator.generate(),
      eventType: TEAM_ARCHIVED_EVENT,
      actorUserId: actor.userId,
      context: { teamId: team.id },
      occurredAt: now,
    };
  }
}
