import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import { RosterEntryRepository } from '../infrastructure/roster-entry.repository';
import type { PageRequest, RosterEntryPage } from '../model/rosters.types';
import { RosterLookupService } from './roster-lookup.service';

/**
 * Read side of roster entries (roster.read). Returns EVERY entry — active and
 * withdrawn — so a roster export lists each rostered player exactly once even
 * when they recorded nothing, and a removal is visible as history rather than as
 * a disappearance. Bounded and deterministically ordered.
 */
@Injectable()
export class RosterEntryQueryService {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    private readonly lookup: RosterLookupService,
    private readonly entries: RosterEntryRepository,
  ) {}

  listForRoster(
    teamId: string,
    rosterId: string,
    page: PageRequest,
  ): Promise<RosterEntryPage> {
    return this.unitOfWork.runInTransaction(tx =>
      this.page(tx, teamId, rosterId, page),
    );
  }

  private async page(
    tx: TransactionScope,
    teamId: string,
    rosterId: string,
    page: PageRequest,
  ): Promise<RosterEntryPage> {
    const roster = await this.lookup.require(tx, teamId, rosterId);
    const items = await this.entries.listForRoster(tx, roster.rosterId, page);
    const total = await this.entries.countForRoster(tx, roster.rosterId);
    return { items, total, limit: page.limit, offset: page.offset };
  }
}
