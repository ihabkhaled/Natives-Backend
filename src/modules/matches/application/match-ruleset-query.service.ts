import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import { MatchRulesetRepository } from '../infrastructure/match-ruleset.repository';
import type { MatchRulesetPage, PageRequest } from '../model/matches.types';

/**
 * Read side of the versioned scoring rule sets (match.read). Lists every version
 * a team has published, newest version first per key, so a historical match can
 * always be explained by the exact rules it was played under.
 */
@Injectable()
export class MatchRulesetQueryService {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    private readonly repository: MatchRulesetRepository,
  ) {}

  listForTeam(teamId: string, page: PageRequest): Promise<MatchRulesetPage> {
    return this.unitOfWork.runInTransaction(tx => this.page(tx, teamId, page));
  }

  private async page(
    tx: TransactionScope,
    teamId: string,
    page: PageRequest,
  ): Promise<MatchRulesetPage> {
    const items = await this.repository.listForTeam(tx, teamId, page);
    const total = await this.repository.countForTeam(tx, teamId);
    return { items, total, limit: page.limit, offset: page.offset };
  }
}
