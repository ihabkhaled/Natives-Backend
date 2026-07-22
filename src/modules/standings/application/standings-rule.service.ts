import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import { StandingsRuleNotFoundError } from '../errors/standings-rule-not-found.error';
import { StandingsRuleRepository } from '../infrastructure/standings-rule.repository';
import { FIRST_RULE_VERSION } from '../model/standings.constants';
import type {
  PageRequest,
  StandingsRulePage,
  StandingsRuleVersion,
} from '../model/standings.types';

/**
 * Read side and resolution of named standings rule versions. `require` resolves
 * the newest ACTIVE version of a rule key — the version a fresh computation runs
 * under — and a miss is a 404 rather than a silent fallback to a default, so a
 * table is never produced under rules nobody published.
 */
@Injectable()
export class StandingsRuleService {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    private readonly repository: StandingsRuleRepository,
  ) {}

  listForTeam(teamId: string, page: PageRequest): Promise<StandingsRulePage> {
    return this.unitOfWork.runInTransaction(tx => this.page(tx, teamId, page));
  }

  async require(
    tx: TransactionScope,
    teamId: string,
    ruleKey: string,
  ): Promise<StandingsRuleVersion> {
    const rule = await this.repository.findLatestByKey(tx, teamId, ruleKey);
    if (rule === null) {
      throw new StandingsRuleNotFoundError();
    }
    return rule;
  }

  /** The version number the next publication of a rule key takes. */
  async nextVersion(
    tx: TransactionScope,
    teamId: string,
    ruleKey: string,
  ): Promise<number> {
    const latest = await this.repository.findLatestByKey(tx, teamId, ruleKey);
    return latest === null ? FIRST_RULE_VERSION : latest.version + 1;
  }

  private async page(
    tx: TransactionScope,
    teamId: string,
    page: PageRequest,
  ): Promise<StandingsRulePage> {
    const items = await this.repository.listForTeam(tx, teamId, page);
    const total = await this.repository.countForTeam(tx, teamId);
    return { items, total, limit: page.limit, offset: page.offset };
  }
}
