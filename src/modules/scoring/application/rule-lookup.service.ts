import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { CalculationRuleNotFoundError } from '../errors/calculation-rule-not-found.error';
import { CalculationRuleRepository } from '../infrastructure/calculation-rule.repository';
import type { CalculationRule } from '../model/scoring.types';

/**
 * Resolves a team-owned calculation rule for a write, or a visible rule (team or
 * seeded global candidate) for a read. A missing rule becomes a 404 that hides
 * existence — a team admin never learns another team's rule ids.
 */
@Injectable()
export class RuleLookupService {
  constructor(private readonly repository: CalculationRuleRepository) {}

  async requireForWrite(
    scope: TransactionScope,
    teamId: string,
    ruleId: string,
  ): Promise<CalculationRule> {
    const rule = await this.repository.findForWrite(scope, teamId, ruleId);
    if (rule === null) {
      throw new CalculationRuleNotFoundError();
    }
    return rule;
  }

  async requireVisible(
    scope: TransactionScope,
    teamId: string,
    ruleId: string,
  ): Promise<CalculationRule> {
    const rule = await this.repository.findVisible(scope, teamId, ruleId);
    if (rule === null) {
      throw new CalculationRuleNotFoundError();
    }
    return rule;
  }
}
