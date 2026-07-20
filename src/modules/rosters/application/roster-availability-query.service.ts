import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import { RosterAvailabilityRepository } from '../infrastructure/roster-availability.repository';
import type {
  PageRequest,
  RosterAvailabilityPage,
} from '../model/rosters.types';
import { RosterLookupService } from './roster-lookup.service';

/**
 * Read side of roster availability (roster.read). A member who never declared
 * simply has no row — an absent declaration is never rendered as a refusal.
 * Bounded and deterministically ordered, one transaction per call.
 */
@Injectable()
export class RosterAvailabilityQueryService {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    private readonly lookup: RosterLookupService,
    private readonly availability: RosterAvailabilityRepository,
  ) {}

  listForRoster(
    teamId: string,
    rosterId: string,
    page: PageRequest,
  ): Promise<RosterAvailabilityPage> {
    return this.unitOfWork.runInTransaction(tx =>
      this.page(tx, teamId, rosterId, page),
    );
  }

  private async page(
    tx: TransactionScope,
    teamId: string,
    rosterId: string,
    page: PageRequest,
  ): Promise<RosterAvailabilityPage> {
    const roster = await this.lookup.require(tx, teamId, rosterId);
    const items = await this.availability.listForRoster(
      tx,
      roster.rosterId,
      page,
    );
    const total = await this.availability.countForRoster(tx, roster.rosterId);
    return { items, total, limit: page.limit, offset: page.offset };
  }
}
