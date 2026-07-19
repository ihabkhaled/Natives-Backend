import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { REBUILD_SCAN_MAX } from '../model/scoring.constants';
import type { CategorySourceRow, MembershipRow } from '../model/scoring.rows';

/**
 * Read-only source-fact access for projection rebuilds and simulations. Reads
 * published, non-superseded player assessments and aggregates the assessed metric
 * values per membership+category. Null observations are excluded from the value
 * array but still counted in the total so coverage stays honest; a measured 0 is
 * carried as a present value. Data access only — bounded and deterministically
 * ordered.
 */
@Injectable()
export class ScoreSourceRepository {
  async listActiveMemberships(
    scope: TransactionScope,
    teamId: string,
  ): Promise<readonly MembershipRow[]> {
    return scope.run<MembershipRow>(
      `SELECT "id" AS "membership_id" FROM "memberships"
        WHERE "team_id" = $1 AND "status" = 'active' AND "deleted_at" IS NULL
        ORDER BY "id" ASC
        LIMIT ${REBUILD_SCAN_MAX}`,
      [teamId],
    );
  }

  async categorySourcesForTeam(
    scope: TransactionScope,
    teamId: string,
  ): Promise<readonly CategorySourceRow[]> {
    return scope.run<CategorySourceRow>(this.sourcesSql(false), [teamId]);
  }

  async categorySourcesForMembership(
    scope: TransactionScope,
    teamId: string,
    membershipId: string,
  ): Promise<readonly CategorySourceRow[]> {
    return scope.run<CategorySourceRow>(this.sourcesSql(true), [
      teamId,
      membershipId,
    ]);
  }

  private sourcesSql(singleMembership: boolean): string {
    const membershipFilter = singleMembership
      ? `AND pa."membership_id" = $2`
      : '';
    return `SELECT pa."membership_id" AS "membership_id",
              cat."category_key" AS "category_key",
              COALESCE(
                array_agg(v."numeric_value")
                  FILTER (WHERE v."numeric_value" IS NOT NULL),
                '{}'
              ) AS "values",
              COUNT(*)::int AS "total_metrics"
         FROM "player_assessments" pa
         JOIN "player_assessment_metric_values" v
           ON v."assessment_id" = pa."id"
         JOIN "assessment_metric_definitions" md
           ON md."id" = v."metric_definition_id"
         JOIN "assessment_metric_categories" cat
           ON cat."id" = md."category_id"
        WHERE pa."team_id" = $1 AND pa."status" = 'published'
          AND pa."superseded_at" IS NULL ${membershipFilter}
        GROUP BY pa."membership_id", cat."category_key"
        ORDER BY pa."membership_id" ASC, cat."category_key" ASC`;
  }
}
