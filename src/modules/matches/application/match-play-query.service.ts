import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import { MatchPlayEventRepository } from '../infrastructure/match-play-event.repository';
import type { MatchPlayPage, PageRequest } from '../model/matches.types';
import { MatchLookupService } from './match-lookup.service';

/**
 * Read side of the append-only point/possession stream (match.read). Returns the
 * whole recorded history — including facts a later correction retracted, flagged
 * as such — in sequence order, so every derived statistic can be traced back to
 * the facts that produced it rather than trusted as a number.
 */
@Injectable()
export class MatchPlayQueryService {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    private readonly lookup: MatchLookupService,
    private readonly plays: MatchPlayEventRepository,
  ) {}

  listForMatch(
    teamId: string,
    matchId: string,
    page: PageRequest,
  ): Promise<MatchPlayPage> {
    return this.unitOfWork.runInTransaction(tx =>
      this.page(tx, teamId, matchId, page),
    );
  }

  private async page(
    tx: TransactionScope,
    teamId: string,
    matchId: string,
    page: PageRequest,
  ): Promise<MatchPlayPage> {
    await this.lookup.require(tx, teamId, matchId);
    const items = await this.plays.listForMatch(tx, matchId, page);
    const total = await this.plays.countForMatch(tx, matchId);
    return { items, total, limit: page.limit, offset: page.offset };
  }
}
