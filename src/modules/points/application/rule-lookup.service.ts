import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { PointsRuleNotFoundError } from '../errors/points-rule-not-found.error';
import { PointsRuleRepository } from '../infrastructure/points-rule.repository';
import type { PointsRule } from '../model/points.types';

/**
 * Resolves a team-owned points rule for a write, translating a miss into a 404
 * that hides existence. Only the team's own rules are writable — the seeded global
 * candidates (team_id IS NULL) are read-only references.
 */
@Injectable()
export class RuleLookupService {
  constructor(private readonly repository: PointsRuleRepository) {}

  async requireForWrite(
    scope: TransactionScope,
    teamId: string,
    ruleId: string,
  ): Promise<PointsRule> {
    const rule = await this.repository.findForWrite(scope, teamId, ruleId);
    if (rule === null) {
      throw new PointsRuleNotFoundError();
    }
    return rule;
  }
}
