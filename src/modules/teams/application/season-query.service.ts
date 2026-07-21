import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import { CurrentSeasonNotFoundError } from '../errors/current-season-not-found.error';
import { SeasonRepository } from '../infrastructure/season.repository';
import type {
  ListSeasonsResult,
  PageRequest,
  Season,
} from '../model/teams.types';

/**
 * Read side for seasons: a bounded, deterministically ordered page of a team's
 * seasons (by start date), and the team's single current season. Team scope
 * comes from the route param, which the permission guard also uses to enforce
 * team-scoped access.
 */
@Injectable()
export class SeasonQueryService {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    private readonly seasons: SeasonRepository,
  ) {}

  listSeasons(teamId: string, page: PageRequest): Promise<ListSeasonsResult> {
    return this.unitOfWork.runInTransaction(scope =>
      this.seasons.list(scope, teamId, page),
    );
  }

  /**
   * The team's current season — the single `active` one the partial unique index
   * guarantees. A team with none raises not-found rather than guessing a season,
   * so `period=season` consumers never silently read the wrong window.
   */
  getCurrentSeason(teamId: string): Promise<Season> {
    return this.unitOfWork.runInTransaction(scope =>
      this.loadCurrent(scope, teamId),
    );
  }

  private async loadCurrent(
    scope: TransactionScope,
    teamId: string,
  ): Promise<Season> {
    const season = await this.seasons.findCurrent(scope, teamId);
    if (season === null) {
      throw new CurrentSeasonNotFoundError();
    }
    return season;
  }
}
