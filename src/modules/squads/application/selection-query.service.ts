import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import { SquadSelectionRepository } from '../infrastructure/squad-selection.repository';
import type { PageRequest, SelectionPage } from '../model/squads.types';
import { SquadLookupService } from './squad-lookup.service';

/**
 * Read side of squad selections (squad.read). Resolves the squad first so a
 * cross-team id is a 404, then returns a bounded, deterministically ordered page
 * of selections (active and removed, for history). One transaction per call.
 */
@Injectable()
export class SelectionQueryService {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    private readonly lookup: SquadLookupService,
    private readonly repository: SquadSelectionRepository,
  ) {}

  listForSquad(
    teamId: string,
    squadId: string,
    page: PageRequest,
  ): Promise<SelectionPage> {
    return this.unitOfWork.runInTransaction(tx =>
      this.page(tx, teamId, squadId, page),
    );
  }

  private async page(
    tx: TransactionScope,
    teamId: string,
    squadId: string,
    page: PageRequest,
  ): Promise<SelectionPage> {
    await this.lookup.require(tx, teamId, squadId);
    const items = await this.repository.listForSquad(tx, squadId, page);
    const total = await this.repository.countForSquad(tx, squadId);
    return { items, total, limit: page.limit, offset: page.offset };
  }
}
