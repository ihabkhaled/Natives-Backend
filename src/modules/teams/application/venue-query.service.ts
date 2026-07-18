import {
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import { VenueRepository } from '../infrastructure/venue.repository';
import type { ListVenuesResult, PageRequest } from '../model/teams.types';

/**
 * Read side for venues: a bounded, deterministically ordered page of a team's
 * venues (by name). Team scope comes from the route param the guard enforces.
 */
@Injectable()
export class VenueQueryService {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    private readonly venues: VenueRepository,
  ) {}

  listVenues(teamId: string, page: PageRequest): Promise<ListVenuesResult> {
    return this.unitOfWork.runInTransaction(scope =>
      this.venues.list(scope, teamId, page),
    );
  }
}
