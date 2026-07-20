import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import type { PointsStandingRow } from '../model/signals.rows';

/**
 * Persistence for the points dashboard projection. One parameterized statement
 * aggregates the team's ledger into per-member totals, ranks them in the
 * database, and returns only the requested member's row — so the caller never
 * pages a leaderboard to find one standing, and never receives a stored total.
 */
@Injectable()
export class PointsDashboardRepository {
  standingFor(
    scope: TransactionScope,
    teamId: string,
    seasonId: string | null,
    membershipId: string,
  ): Promise<PointsStandingRow[]> {
    return scope.run<PointsStandingRow>(
      `WITH "totals" AS (
         SELECT "l"."membership_id" AS "membership_id",
                SUM("l"."amount") AS "total",
                MAX("l"."created_at") AS "latest_at"
           FROM "points_ledger" "l"
          WHERE "l"."team_id" = $1
            AND ($2::uuid IS NULL OR "l"."season_id" = $2)
          GROUP BY "l"."membership_id"
       ), "ranked" AS (
         SELECT "t"."membership_id" AS "membership_id", "t"."total" AS "total",
                "t"."latest_at" AS "latest_at",
                RANK() OVER (ORDER BY "t"."total" DESC) AS "rank",
                COUNT(*) OVER () AS "population"
           FROM "totals" "t"
       )
       SELECT "r"."total" AS "total", "r"."rank"::int AS "rank",
              "r"."population"::int AS "population",
              "r"."latest_at" AS "latest_at"
         FROM "ranked" "r"
        WHERE "r"."membership_id" = $3
        LIMIT 1`,
      [teamId, seasonId, membershipId],
    );
  }
}
