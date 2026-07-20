import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import { MatchRevisionRepository } from '../infrastructure/match-revision.repository';
import type { MatchRevisionPage, PageRequest } from '../model/matches.types';
import { MatchLookupService } from './match-lookup.service';

/**
 * Read side of the immutable correction trail (match.read). Every finalization,
 * reopening, and correction of a match is listed with the score before and after,
 * so a changed final score is always an attributable, reviewable delta.
 */
@Injectable()
export class MatchRevisionQueryService {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    private readonly lookup: MatchLookupService,
    private readonly revisions: MatchRevisionRepository,
  ) {}

  listForMatch(
    teamId: string,
    matchId: string,
    page: PageRequest,
  ): Promise<MatchRevisionPage> {
    return this.unitOfWork.runInTransaction(tx =>
      this.page(tx, teamId, matchId, page),
    );
  }

  private async page(
    tx: TransactionScope,
    teamId: string,
    matchId: string,
    page: PageRequest,
  ): Promise<MatchRevisionPage> {
    await this.lookup.require(tx, teamId, matchId);
    const items = await this.revisions.listForMatch(tx, matchId, page);
    const total = await this.revisions.countForMatch(tx, matchId);
    return { items, total, limit: page.limit, offset: page.offset };
  }
}
