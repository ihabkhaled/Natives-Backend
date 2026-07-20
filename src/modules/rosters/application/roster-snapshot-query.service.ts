import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import { RosterSnapshotRepository } from '../infrastructure/roster-snapshot.repository';
import type { PageRequest, RosterSnapshotPage } from '../model/rosters.types';
import { RosterLookupService } from './roster-lookup.service';

/**
 * Read side of roster snapshots (roster.read). Snapshots are the auditable
 * history of a roster: newest first, bounded, and never recomputed on read — what
 * was frozen is exactly what is returned, even when the live roster has since
 * moved on.
 */
@Injectable()
export class RosterSnapshotQueryService {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    private readonly lookup: RosterLookupService,
    private readonly snapshots: RosterSnapshotRepository,
  ) {}

  listForRoster(
    teamId: string,
    rosterId: string,
    page: PageRequest,
  ): Promise<RosterSnapshotPage> {
    return this.unitOfWork.runInTransaction(tx =>
      this.page(tx, teamId, rosterId, page),
    );
  }

  private async page(
    tx: TransactionScope,
    teamId: string,
    rosterId: string,
    page: PageRequest,
  ): Promise<RosterSnapshotPage> {
    const roster = await this.lookup.require(tx, teamId, rosterId);
    const items = await this.snapshots.listForRoster(tx, roster.rosterId, page);
    const total = await this.snapshots.countForRoster(tx, roster.rosterId);
    return { items, total, limit: page.limit, offset: page.offset };
  }
}
