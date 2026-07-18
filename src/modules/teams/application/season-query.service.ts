import {
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import { SeasonRepository } from '../infrastructure/season.repository';
import type { ListSeasonsResult, PageRequest } from '../model/teams.types';

/**
 * Read side for seasons: a bounded, deterministically ordered page of a team's
 * seasons (by start date). Team scope comes from the route param, which the
 * permission guard also uses to enforce team-scoped access.
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
}
