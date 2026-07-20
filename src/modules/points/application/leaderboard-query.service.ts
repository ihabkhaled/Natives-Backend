import { CLOCK_PORT, type ClockPort } from '@core/clock/clock.port';
import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import { PointsScopeNotFoundError } from '../errors/points-scope-not-found.error';
import { PointsValidationError } from '../errors/points-validation.error';
import { LeaderboardRepository } from '../infrastructure/leaderboard.repository';
import { assembleLeaderboard } from '../lib/leaderboard.assembler';
import { computePeriodWindows } from '../lib/leaderboard-window';
import { LeaderboardPeriod } from '../model/leaderboard.enums';
import type {
  LeaderboardQuery,
  LeaderboardResult,
  LeaderboardWindows,
  SeasonBounds,
} from '../model/leaderboard.types';
import { LeaderboardDataService } from './leaderboard-data.service';
import { PointsScopeService } from './points-scope.service';

/**
 * Read side of the fair, transparent team leaderboard. In one transaction it
 * validates the team/season scope, resolves the current and previous Africa/Cairo
 * windows (stored UTC), collects the bounded cohort aggregates, and returns the
 * deterministically ranked page with movement and per-row explanations. Totals are
 * projections; the season window requires a season, and a missing one hides
 * existence with a 404.
 */
@Injectable()
export class LeaderboardQueryService {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    private readonly scope: PointsScopeService,
    private readonly repository: LeaderboardRepository,
    private readonly data: LeaderboardDataService,
  ) {}

  teamLeaderboard(
    teamId: string,
    query: LeaderboardQuery,
  ): Promise<LeaderboardResult> {
    return this.unitOfWork.runInTransaction(tx =>
      this.build(tx, teamId, query),
    );
  }

  private async build(
    tx: TransactionScope,
    teamId: string,
    query: LeaderboardQuery,
  ): Promise<LeaderboardResult> {
    await this.scope.validate(tx, teamId, query.seasonId);
    const windows = await this.resolveWindows(tx, teamId, query);
    const data = await this.data.collect(tx, teamId, query, windows);
    return assembleLeaderboard(data, query, this.clock.now());
  }

  private async resolveWindows(
    tx: TransactionScope,
    teamId: string,
    query: LeaderboardQuery,
  ): Promise<LeaderboardWindows> {
    if (query.period !== LeaderboardPeriod.Season) {
      return computePeriodWindows(query.period, this.clock.now(), null);
    }
    const bounds = await this.seasonBounds(tx, teamId, query);
    return computePeriodWindows(query.period, this.clock.now(), bounds);
  }

  private async seasonBounds(
    tx: TransactionScope,
    teamId: string,
    query: LeaderboardQuery,
  ): Promise<SeasonBounds> {
    if (query.seasonId === null) {
      throw new PointsValidationError();
    }
    const bounds = await this.repository.seasonBounds(
      tx,
      teamId,
      query.seasonId,
    );
    if (bounds === null) {
      throw new PointsScopeNotFoundError();
    }
    return bounds;
  }
}
