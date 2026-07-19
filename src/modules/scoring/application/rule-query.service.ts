import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import { CalculationRuleRepository } from '../infrastructure/calculation-rule.repository';
import type {
  CalculationRule,
  CalculationRulePage,
  PageRequest,
} from '../model/scoring.types';
import { RuleLookupService } from './rule-lookup.service';

/**
 * Read side of calculation rules. Every list is one bounded, deterministically
 * ordered page in a single transaction. Team admins see their team's rules plus
 * the seeded global candidates; detail reads resolve a visible rule or 404.
 */
@Injectable()
export class RuleQueryService {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    private readonly repository: CalculationRuleRepository,
    private readonly lookup: RuleLookupService,
  ) {}

  listForTeam(teamId: string, page: PageRequest): Promise<CalculationRulePage> {
    return this.unitOfWork.runInTransaction(tx =>
      this.teamPage(tx, teamId, page),
    );
  }

  getDetail(teamId: string, ruleId: string): Promise<CalculationRule> {
    return this.unitOfWork.runInTransaction(tx =>
      this.lookup.requireVisible(tx, teamId, ruleId),
    );
  }

  private async teamPage(
    tx: TransactionScope,
    teamId: string,
    page: PageRequest,
  ): Promise<CalculationRulePage> {
    const items = await this.repository.listForTeam(tx, teamId, page);
    const total = await this.repository.countForTeam(tx, teamId);
    return { items, total, limit: page.limit, offset: page.offset };
  }
}
