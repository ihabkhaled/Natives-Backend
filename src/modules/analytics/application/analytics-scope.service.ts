import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { AnalyticsScopeNotFoundError } from '../errors/analytics-scope-not-found.error';
import { AnalyticsFactRepository } from '../infrastructure/analytics-fact.repository';

/**
 * Enforces the team/member scope of an analytics operation. A missing or foreign
 * scope resolves to a 404 that hides existence, so a caller cannot probe another
 * team's read models by id.
 */
@Injectable()
export class AnalyticsScopeService {
  constructor(private readonly facts: AnalyticsFactRepository) {}

  async requireTeam(scope: TransactionScope, teamId: string): Promise<void> {
    if (!(await this.facts.activeTeamExists(scope, teamId))) {
      throw new AnalyticsScopeNotFoundError();
    }
  }

  async requireMember(
    scope: TransactionScope,
    teamId: string,
    membershipId: string,
  ): Promise<void> {
    if (!(await this.facts.membershipExists(scope, teamId, membershipId))) {
      throw new AnalyticsScopeNotFoundError();
    }
  }
}
