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

import { SeasonNotFoundError } from '../errors/season-not-found.error';
import { SeasonRepository } from '../infrastructure/season.repository';
import { TeamAuditRepository } from '../infrastructure/team-audit.repository';
import { SEASON_ARCHIVED_EVENT } from '../model/teams.constants';
import type { NewAuditEvent, Season } from '../model/teams.types';

/**
 * Archives a season within its team scope. A season belonging to another team, an
 * unknown season, or an already-archived season resolves to not-found (404),
 * hiding cross-team existence.
 */
@Injectable()
export class ArchiveSeasonUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR_PORT) private readonly idGenerator: IdGeneratorPort,
    private readonly seasons: SeasonRepository,
    private readonly audit: TeamAuditRepository,
  ) {}

  execute(
    actor: AuthUserIdentity,
    teamId: string,
    seasonId: string,
  ): Promise<Season> {
    return this.unitOfWork.runInTransaction(scope =>
      this.run(scope, actor, teamId, seasonId),
    );
  }

  private async run(
    scope: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    seasonId: string,
  ): Promise<Season> {
    const now = this.clock.now();
    const archived = await this.seasons.archive(
      scope,
      teamId,
      seasonId,
      actor.userId,
      now,
    );
    if (archived === null) {
      throw new SeasonNotFoundError();
    }
    await this.audit.append(scope, this.buildAudit(actor, archived, now));
    return archived;
  }

  private buildAudit(
    actor: AuthUserIdentity,
    season: Season,
    now: Date,
  ): NewAuditEvent {
    return {
      id: this.idGenerator.generate(),
      eventType: SEASON_ARCHIVED_EVENT,
      actorUserId: actor.userId,
      context: { teamId: season.teamId, seasonId: season.id },
      occurredAt: now,
    };
  }
}
