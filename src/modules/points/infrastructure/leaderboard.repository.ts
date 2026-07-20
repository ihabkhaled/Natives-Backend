import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import {
  cohortStatuses,
  toCohortMember,
  toMemberBadgeCount,
  toMemberCategoryTotal,
  toMemberTotal,
  toSeasonBounds,
} from '../lib/leaderboard.mapper';
import { LEADERBOARD_COHORT_MAX } from '../model/leaderboard.constants';
import type { LeaderboardCohort } from '../model/leaderboard.enums';
import type {
  CohortMember,
  MemberBadgeCount,
  MemberCategoryTotal,
  MemberTotal,
  PeriodWindow,
  SeasonBounds,
} from '../model/leaderboard.types';
import type {
  CohortMemberRow,
  MemberBadgeCountRow,
  MemberCategoryTotalRow,
  MemberTotalRow,
  SeasonBoundsRow,
} from '../model/points.rows';

/**
 * Bounded, parameterized reads backing the leaderboard projection. The cohort scan
 * is hard-capped (never an unbounded export); every windowed aggregate filters on
 * `team_id` plus a half-open UTC instant window and an optional single category,
 * grouped per membership. Totals are always summed here — never a stored counter.
 */
@Injectable()
export class LeaderboardRepository {
  async cohortMembers(
    scope: TransactionScope,
    teamId: string,
    cohort: LeaderboardCohort,
  ): Promise<readonly CohortMember[]> {
    const rows = await scope.run<CohortMemberRow>(
      `SELECT "id" AS "membership_id", "status" FROM "memberships"
        WHERE "team_id" = $1 AND "deleted_at" IS NULL
          AND ($2::text[] IS NULL OR "status" = ANY($2))
        ORDER BY "id" ASC
        LIMIT $3`,
      [teamId, cohortStatuses(cohort), LEADERBOARD_COHORT_MAX],
    );
    return rows.map(row => toCohortMember(row));
  }

  async windowTotals(
    scope: TransactionScope,
    teamId: string,
    window: PeriodWindow,
    category: string | null,
  ): Promise<readonly MemberTotal[]> {
    const rows = await scope.run<MemberTotalRow>(
      `SELECT "membership_id", SUM("amount")::text AS "total"
        FROM "points_ledger"
        WHERE "team_id" = $1
          AND ($2::timestamptz IS NULL OR "created_at" >= $2)
          AND ($3::timestamptz IS NULL OR "created_at" < $3)
          AND ($4::text IS NULL OR "activity_category" = $4)
        GROUP BY "membership_id"`,
      [
        teamId,
        this.isoOrNull(window.startUtc),
        this.isoOrNull(window.endUtc),
        category,
      ],
    );
    return rows.map(row => toMemberTotal(row));
  }

  async categoryTotals(
    scope: TransactionScope,
    teamId: string,
    window: PeriodWindow,
    category: string | null,
  ): Promise<readonly MemberCategoryTotal[]> {
    const rows = await scope.run<MemberCategoryTotalRow>(
      `SELECT "membership_id", "activity_category",
         SUM("amount")::text AS "total"
        FROM "points_ledger"
        WHERE "team_id" = $1
          AND ($2::timestamptz IS NULL OR "created_at" >= $2)
          AND ($3::timestamptz IS NULL OR "created_at" < $3)
          AND ($4::text IS NULL OR "activity_category" = $4)
        GROUP BY "membership_id", "activity_category"`,
      [
        teamId,
        this.isoOrNull(window.startUtc),
        this.isoOrNull(window.endUtc),
        category,
      ],
    );
    return rows.map(row => toMemberCategoryTotal(row));
  }

  async badgeCounts(
    scope: TransactionScope,
    teamId: string,
  ): Promise<readonly MemberBadgeCount[]> {
    const rows = await scope.run<MemberBadgeCountRow>(
      `SELECT "membership_id", COUNT(*)::int AS "badge_count"
        FROM "player_badges"
        WHERE "team_id" = $1
        GROUP BY "membership_id"`,
      [teamId],
    );
    return rows.map(row => toMemberBadgeCount(row));
  }

  async seasonBounds(
    scope: TransactionScope,
    teamId: string,
    seasonId: string,
  ): Promise<SeasonBounds | null> {
    const rows = await scope.run<SeasonBoundsRow>(
      `SELECT to_char("starts_on", 'YYYY-MM-DD') AS "starts_on",
         to_char("ends_on", 'YYYY-MM-DD') AS "ends_on"
        FROM "seasons"
        WHERE "id" = $1 AND "team_id" = $2 AND "status" <> 'archived'`,
      [seasonId, teamId],
    );
    const row = rows[0];
    return row === undefined ? null : toSeasonBounds(row);
  }

  private isoOrNull(instant: Date | null): string | null {
    return instant === null ? null : instant.toISOString();
  }
}
