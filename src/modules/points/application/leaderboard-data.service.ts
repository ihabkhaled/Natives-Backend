import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { LeaderboardRepository } from '../infrastructure/leaderboard.repository';
import type {
  CohortMember,
  LeaderboardData,
  LeaderboardQuery,
  LeaderboardWindows,
  MemberCategoryTotal,
  MemberTotal,
} from '../model/leaderboard.types';

/**
 * Collects every aggregate the leaderboard projection needs in one transaction:
 * the bounded cohort, the current-window totals, the previous-window totals (only
 * when the window has a comparable previous period), the per-category
 * contributions, and the badge counts. Sequential reads only — no `Promise.all`.
 */
@Injectable()
export class LeaderboardDataService {
  constructor(private readonly repository: LeaderboardRepository) {}

  async collect(
    scope: TransactionScope,
    teamId: string,
    query: LeaderboardQuery,
    windows: LeaderboardWindows,
  ): Promise<LeaderboardData> {
    const cohort = await this.cohort(scope, teamId, query);
    const currentTotals = await this.current(scope, teamId, query, windows);
    const previousTotals = await this.previous(scope, teamId, query, windows);
    const categoryTotals = await this.categories(scope, teamId, query, windows);
    const badgeCounts = await this.repository.badgeCounts(scope, teamId);
    return {
      cohort,
      currentTotals,
      previousTotals,
      categoryTotals,
      badgeCounts,
    };
  }

  private cohort(
    scope: TransactionScope,
    teamId: string,
    query: LeaderboardQuery,
  ): Promise<readonly CohortMember[]> {
    return this.repository.cohortMembers(scope, teamId, query.cohort);
  }

  private current(
    scope: TransactionScope,
    teamId: string,
    query: LeaderboardQuery,
    windows: LeaderboardWindows,
  ): Promise<readonly MemberTotal[]> {
    return this.repository.windowTotals(
      scope,
      teamId,
      windows.current,
      query.category,
    );
  }

  private categories(
    scope: TransactionScope,
    teamId: string,
    query: LeaderboardQuery,
    windows: LeaderboardWindows,
  ): Promise<readonly MemberCategoryTotal[]> {
    return this.repository.categoryTotals(
      scope,
      teamId,
      windows.current,
      query.category,
    );
  }

  private async previous(
    scope: TransactionScope,
    teamId: string,
    query: LeaderboardQuery,
    windows: LeaderboardWindows,
  ): Promise<readonly MemberTotal[] | null> {
    if (windows.previous === null) {
      return null;
    }
    return this.repository.windowTotals(
      scope,
      teamId,
      windows.previous,
      query.category,
    );
  }
}
