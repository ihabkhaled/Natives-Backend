import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import { MatchEventRepository } from '../infrastructure/match-event.repository';
import type { MatchEventPage, PageRequest } from '../model/matches.types';
import { MatchLookupService } from './match-lookup.service';

/**
 * Read side of the append-only match stream (match.read). Returns the whole
 * recorded history — including facts a later void compensated — in sequence
 * order, so the displayed score is always reproducible from its sources rather
 * than trusted as a stored number.
 */
@Injectable()
export class MatchEventQueryService {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    private readonly lookup: MatchLookupService,
    private readonly events: MatchEventRepository,
  ) {}

  listForMatch(
    teamId: string,
    matchId: string,
    page: PageRequest,
  ): Promise<MatchEventPage> {
    return this.unitOfWork.runInTransaction(tx =>
      this.page(tx, teamId, matchId, page),
    );
  }

  private async page(
    tx: TransactionScope,
    teamId: string,
    matchId: string,
    page: PageRequest,
  ): Promise<MatchEventPage> {
    await this.lookup.require(tx, teamId, matchId);
    const items = await this.events.listForMatch(tx, matchId, page);
    const total = await this.events.countForMatch(tx, matchId);
    return { items, total, limit: page.limit, offset: page.offset };
  }
}
