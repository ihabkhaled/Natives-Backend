import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import { RosterRepository } from '../infrastructure/roster.repository';
import type {
  PageRequest,
  Roster,
  RosterListFilter,
  RosterPage,
} from '../model/rosters.types';
import { RosterLookupService } from './roster-lookup.service';

/**
 * Read side of rosters (roster.read). Lists a team's competition and match
 * rosters in a bounded, deterministically ordered page under allow-listed
 * filters, and resolves a single roster (a miss is a 404). One transaction per
 * call.
 */
@Injectable()
export class RosterQueryService {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    private readonly repository: RosterRepository,
    private readonly lookup: RosterLookupService,
  ) {}

  listForScope(
    teamId: string,
    filter: RosterListFilter,
    page: PageRequest,
  ): Promise<RosterPage> {
    return this.unitOfWork.runInTransaction(tx =>
      this.page(tx, teamId, filter, page),
    );
  }

  getById(teamId: string, rosterId: string): Promise<Roster> {
    return this.unitOfWork.runInTransaction(tx =>
      this.lookup.require(tx, teamId, rosterId),
    );
  }

  private async page(
    tx: TransactionScope,
    teamId: string,
    filter: RosterListFilter,
    page: PageRequest,
  ): Promise<RosterPage> {
    const items = await this.repository.listForScope(tx, teamId, filter, page);
    const total = await this.repository.countForScope(tx, teamId, filter);
    return { items, total, limit: page.limit, offset: page.offset };
  }
}
