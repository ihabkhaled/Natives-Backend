import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import { MatchRepository } from '../infrastructure/match.repository';
import type {
  Match,
  MatchListFilter,
  MatchPage,
  PageRequest,
} from '../model/matches.types';
import { MatchLookupService } from './match-lookup.service';

/**
 * Read side of matches (match.read). Lists a team's matches in a bounded,
 * deterministically ordered page under allow-listed filters, and resolves a
 * single match (a miss is a 404 that hides existence). One transaction per call.
 */
@Injectable()
export class MatchQueryService {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    private readonly repository: MatchRepository,
    private readonly lookup: MatchLookupService,
  ) {}

  listForScope(
    teamId: string,
    filter: MatchListFilter,
    page: PageRequest,
  ): Promise<MatchPage> {
    return this.unitOfWork.runInTransaction(tx =>
      this.page(tx, teamId, filter, page),
    );
  }

  getById(teamId: string, matchId: string): Promise<Match> {
    return this.unitOfWork.runInTransaction(tx =>
      this.lookup.require(tx, teamId, matchId),
    );
  }

  private async page(
    tx: TransactionScope,
    teamId: string,
    filter: MatchListFilter,
    page: PageRequest,
  ): Promise<MatchPage> {
    const items = await this.repository.listForScope(tx, teamId, filter, page);
    const total = await this.repository.countForScope(tx, teamId, filter);
    return { items, total, limit: page.limit, offset: page.offset };
  }
}
