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

import { claimsCurrentSeasonSlot } from '../domain/season-lifecycle.state-machine';
import {
  findOverlappingSeason,
  isValidSeasonRange,
} from '../domain/season-schedule.policy';
import { OptimisticConflictError } from '../errors/optimistic-conflict.error';
import { SeasonAlreadyActiveError } from '../errors/season-already-active.error';
import { SeasonNotFoundError } from '../errors/season-not-found.error';
import { SeasonOverlapError } from '../errors/season-overlap.error';
import { SlugConflictError } from '../errors/slug-conflict.error';
import { SeasonRepository } from '../infrastructure/season.repository';
import { TeamAuditRepository } from '../infrastructure/team-audit.repository';
import { isIsoCalendarDate } from '../lib/teams.helpers';
import {
  SEASON_INVALID_RANGE_MESSAGE,
  SEASON_INVALID_RANGE_MESSAGE_KEY,
  SEASON_SCAN_LIMIT,
  SEASON_UPDATED_EVENT,
} from '../model/teams.constants';
import { SeasonStatus } from '../model/teams.enums';
import type {
  NewAuditEvent,
  Season,
  SeasonUpdate,
  UpdateSeasonCommand,
} from '../model/teams.types';

/**
 * Updates a season under optimistic concurrency. Re-validates the date order and
 * re-checks overlap against other non-archived seasons (excluding itself), then
 * writes with a version guard. Missing/wrong-team seasons resolve to not-found.
 */
@Injectable()
export class UpdateSeasonUseCase {
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
    command: UpdateSeasonCommand,
  ): Promise<Season> {
    return this.unitOfWork.runInTransaction(scope =>
      this.run(scope, actor, teamId, seasonId, command),
    );
  }

  private async run(
    scope: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    seasonId: string,
    command: UpdateSeasonCommand,
  ): Promise<Season> {
    const existing = await this.seasons.findByIdInTeam(scope, teamId, seasonId);
    if (existing === null) {
      throw new SeasonNotFoundError();
    }
    if (!this.hasValidRange(command.startsOn, command.endsOn)) {
      throw new ValidationError(
        SEASON_INVALID_RANGE_MESSAGE,
        SEASON_INVALID_RANGE_MESSAGE_KEY,
      );
    }
    if (existing.version !== command.expectedVersion) {
      throw new OptimisticConflictError();
    }
    await this.assertAvailable(scope, teamId, seasonId, existing, command);
    return this.applyUpdate(scope, actor, teamId, seasonId, command);
  }

  private hasValidRange(startsOn: string, endsOn: string): boolean {
    return (
      isIsoCalendarDate(startsOn) &&
      isIsoCalendarDate(endsOn) &&
      isValidSeasonRange(startsOn, endsOn)
    );
  }

  private async assertAvailable(
    scope: TransactionScope,
    teamId: string,
    seasonId: string,
    existing: Season,
    command: UpdateSeasonCommand,
  ): Promise<void> {
    if (
      existing.slug.toLowerCase() !== command.slug.toLowerCase() &&
      (await this.seasons.existsBySlug(scope, teamId, command.slug))
    ) {
      throw new SlugConflictError();
    }
    if (
      claimsCurrentSeasonSlot(command.status) &&
      (await this.seasons.hasOtherActive(scope, teamId, seasonId))
    ) {
      throw new SeasonAlreadyActiveError();
    }
    if (command.status === SeasonStatus.Archived) {
      return;
    }
    const ranges = await this.seasons.listActiveRanges(
      scope,
      teamId,
      SEASON_SCAN_LIMIT,
    );
    if (
      findOverlappingSeason(
        ranges,
        command.startsOn,
        command.endsOn,
        seasonId,
      ) !== null
    ) {
      throw new SeasonOverlapError();
    }
  }

  private async applyUpdate(
    scope: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    seasonId: string,
    command: UpdateSeasonCommand,
  ): Promise<Season> {
    const now = this.clock.now();
    const updated = await this.seasons.update(
      scope,
      this.buildUpdate(teamId, seasonId, command, actor, now),
    );
    if (updated === null) {
      throw new OptimisticConflictError();
    }
    await this.audit.append(scope, this.buildAudit(actor, updated, now));
    return updated;
  }

  private buildUpdate(
    teamId: string,
    seasonId: string,
    command: UpdateSeasonCommand,
    actor: AuthUserIdentity,
    now: Date,
  ): SeasonUpdate {
    return {
      id: seasonId,
      teamId,
      slug: command.slug,
      name: command.name,
      startsOn: command.startsOn,
      endsOn: command.endsOn,
      status: command.status,
      updatedBy: actor.userId,
      expectedVersion: command.expectedVersion,
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
      eventType: SEASON_UPDATED_EVENT,
      actorUserId: actor.userId,
      context: {
        teamId: season.teamId,
        seasonId: season.id,
        version: season.version,
      },
      occurredAt: now,
    };
  }
}
