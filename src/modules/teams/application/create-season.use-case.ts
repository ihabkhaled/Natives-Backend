import type { AuthUserIdentity } from '@core/auth';
import { CLOCK_PORT, type ClockPort } from '@core/clock/clock.port';
import { ValidationError } from '@core/errors/validation.error';
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

import {
  findOverlappingSeason,
  isValidSeasonRange,
} from '../domain/season-schedule.policy';
import { SeasonOverlapError } from '../errors/season-overlap.error';
import { SlugConflictError } from '../errors/slug-conflict.error';
import { SeasonRepository } from '../infrastructure/season.repository';
import { TeamAuditRepository } from '../infrastructure/team-audit.repository';
import { isIsoCalendarDate } from '../lib/teams.helpers';
import {
  SEASON_CREATED_EVENT,
  SEASON_INVALID_RANGE_MESSAGE,
  SEASON_INVALID_RANGE_MESSAGE_KEY,
  SEASON_SCAN_LIMIT,
} from '../model/teams.constants';
import { SeasonStatus } from '../model/teams.enums';
import type {
  CreateSeasonCommand,
  NewAuditEvent,
  NewSeason,
  Season,
} from '../model/teams.types';
import { TeamLookupService } from './team-lookup.service';

/**
 * Creates a season within a team. Requires an active team, validates the date
 * order, enforces slug uniqueness, and rejects any date-range overlap with an
 * existing non-archived season. All in one transaction with an audit event.
 */
@Injectable()
export class CreateSeasonUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR_PORT) private readonly idGenerator: IdGeneratorPort,
    private readonly teamLookup: TeamLookupService,
    private readonly seasons: SeasonRepository,
    private readonly audit: TeamAuditRepository,
  ) {}

  execute(
    actor: AuthUserIdentity,
    teamId: string,
    command: CreateSeasonCommand,
  ): Promise<Season> {
    return this.unitOfWork.runInTransaction(scope =>
      this.run(scope, actor, teamId, command),
    );
  }

  private async run(
    scope: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    command: CreateSeasonCommand,
  ): Promise<Season> {
    await this.teamLookup.requireActive(scope, teamId);
    if (!this.hasValidRange(command.startsOn, command.endsOn)) {
      throw new ValidationError(
        SEASON_INVALID_RANGE_MESSAGE,
        SEASON_INVALID_RANGE_MESSAGE_KEY,
      );
    }
    if (await this.seasons.existsBySlug(scope, teamId, command.slug)) {
      throw new SlugConflictError();
    }
    const status = command.status ?? SeasonStatus.Draft;
    await this.assertNoOverlap(scope, teamId, command, status);
    const now = this.clock.now();
    const season = await this.seasons.insert(
      scope,
      this.buildSeason(teamId, command, status, actor, now),
    );
    await this.audit.append(scope, this.buildAudit(actor, season, now));
    return season;
  }

  private hasValidRange(startsOn: string, endsOn: string): boolean {
    return (
      isIsoCalendarDate(startsOn) &&
      isIsoCalendarDate(endsOn) &&
      isValidSeasonRange(startsOn, endsOn)
    );
  }

  private async assertNoOverlap(
    scope: TransactionScope,
    teamId: string,
    command: CreateSeasonCommand,
    status: SeasonStatus,
  ): Promise<void> {
    if (status === SeasonStatus.Archived) {
      return;
    }
    const ranges = await this.seasons.listActiveRanges(
      scope,
      teamId,
      SEASON_SCAN_LIMIT,
    );
    if (
      findOverlappingSeason(ranges, command.startsOn, command.endsOn, null) !==
      null
    ) {
      throw new SeasonOverlapError();
    }
  }

  private buildSeason(
    teamId: string,
    command: CreateSeasonCommand,
    status: SeasonStatus,
    actor: AuthUserIdentity,
    now: Date,
  ): NewSeason {
    return {
      id: this.idGenerator.generate(),
      teamId,
      slug: command.slug,
      name: command.name,
      startsOn: command.startsOn,
      endsOn: command.endsOn,
      status,
      createdBy: actor.userId,
      now,
    };
  }

  private buildAudit(
    actor: AuthUserIdentity,
    season: Season,
    now: Date,
  ): NewAuditEvent {
    return {
      id: this.idGenerator.generate(),
      eventType: SEASON_CREATED_EVENT,
      actorUserId: actor.userId,
      context: { teamId: season.teamId, seasonId: season.id },
      occurredAt: now,
    };
  }
}
