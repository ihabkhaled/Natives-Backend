import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import { orderStandings } from '../domain/standings-tiebreak.policy';
import { StandingRepository } from '../infrastructure/standing.repository';
import { StandingsRuleRepository } from '../infrastructure/standings-rule.repository';
import type {
  CompetitionStanding,
  PageRequest,
  StandingListFilter,
  StandingPage,
} from '../model/standings.types';

/**
 * Read side of competition standings. The page is ordered by the RULE VERSION
 * the rows were computed under, resolved from the rows themselves — never from
 * whatever version happens to be current — so re-reading an old table always
 * reproduces the order it was published in.
 */
@Injectable()
export class StandingsQueryService {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    private readonly repository: StandingRepository,
    private readonly rules: StandingsRuleRepository,
  ) {}

  listForScope(
    teamId: string,
    filter: StandingListFilter,
    page: PageRequest,
  ): Promise<StandingPage> {
    return this.unitOfWork.runInTransaction(tx =>
      this.page(tx, teamId, filter, page),
    );
  }

  private async page(
    tx: TransactionScope,
    teamId: string,
    filter: StandingListFilter,
    page: PageRequest,
  ): Promise<StandingPage> {
    const rows = await this.repository.listForScope(tx, teamId, filter, page);
    const total = await this.repository.countForScope(tx, teamId, filter);
    const items = await this.order(tx, teamId, rows);
    return { items, total, limit: page.limit, offset: page.offset };
  }

  private async order(
    tx: TransactionScope,
    teamId: string,
    rows: readonly CompetitionStanding[],
  ): Promise<readonly CompetitionStanding[]> {
    const first = rows[0];
    if (first === undefined) {
      return rows;
    }
    const rule = await this.rules.findById(tx, teamId, first.ruleVersionId);
    return rule === null ? rows : orderStandings(rows, rule);
  }
}
