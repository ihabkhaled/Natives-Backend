import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import { SquadAvailabilityRepository } from '../infrastructure/squad-availability.repository';
import type { AvailabilityPage, PageRequest } from '../model/squads.types';
import { SquadLookupService } from './squad-lookup.service';

/**
 * Read side of squad availability (squad.read). Resolves the squad first so a
 * cross-team id is a 404, then returns a bounded, deterministically ordered page
 * of declarations. One transaction per call.
 */
@Injectable()
export class AvailabilityQueryService {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    private readonly lookup: SquadLookupService,
    private readonly repository: SquadAvailabilityRepository,
  ) {}

  listForSquad(
    teamId: string,
    squadId: string,
    page: PageRequest,
  ): Promise<AvailabilityPage> {
    return this.unitOfWork.runInTransaction(tx =>
      this.page(tx, teamId, squadId, page),
    );
  }

  private async page(
    tx: TransactionScope,
    teamId: string,
    squadId: string,
    page: PageRequest,
  ): Promise<AvailabilityPage> {
    await this.lookup.require(tx, teamId, squadId);
    const items = await this.repository.listForSquad(tx, squadId, page);
    const total = await this.repository.countForSquad(tx, squadId);
    return { items, total, limit: page.limit, offset: page.offset };
  }
}
