import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { SCAN_MAX_ANOMALIES } from '../model/dataquality.constants';
import {
  AnomalyResourceType,
  DataQualityRule,
} from '../model/dataquality.enums';
import type { DataQualityIdRow, DetectedRow } from '../model/dataquality.rows';
import type { DetectedAnomaly } from '../model/dataquality.types';

/**
 * Read-only detection queries that feed a scan. Every query is a bounded,
 * parameterized read that returns IDS ONLY — never a personal payload — so a
 * detected anomaly references the offending record without copying it.
 * Detection is strictly read-only: nothing here mutates data.
 */
@Injectable()
export class DetectionRepository {
  async activeTeamExists(
    scope: TransactionScope,
    teamId: string,
  ): Promise<boolean> {
    const rows = await scope.run<DataQualityIdRow>(
      `SELECT "id" FROM "teams" WHERE "id" = $1 AND "status" = 'active'`,
      [teamId],
    );
    return rows.length > 0;
  }

  /** Two active reservations holding the same number in the same scope. */
  async detectJerseyConflicts(
    scope: TransactionScope,
    teamId: string,
  ): Promise<readonly DetectedAnomaly[]> {
    const rows = await scope.run<DetectedRow>(
      `SELECT r."season_id"::text || ':' || r."division" || ':'
                || r."number"::text AS "resource_ref",
              'reservation' AS "resource_type",
              COUNT(*)::text AS "detail"
         FROM "number_reservations" r
        WHERE r."team_id" = $1 AND r."status" = 'active'
        GROUP BY r."season_id", r."division", r."number"
       HAVING COUNT(*) > 1
        LIMIT $2`,
      [teamId, SCAN_MAX_ANOMALIES],
    );
    return rows.map(row =>
      this.detected(
        DataQualityRule.JerseyConflict,
        AnomalyResourceType.Reservation,
        row.resource_ref,
      ),
    );
  }

  /** Points ledger entries whose membership no longer exists. */
  async detectOrphanPoints(
    scope: TransactionScope,
    teamId: string,
  ): Promise<readonly DetectedAnomaly[]> {
    const rows = await scope.run<DetectedRow>(
      `SELECT l."id"::text AS "resource_ref", 'ledger_entry' AS "resource_type",
              '' AS "detail"
         FROM "points_ledger" l
         LEFT JOIN "memberships" m ON m."id" = l."membership_id"
        WHERE l."team_id" = $1 AND (m."id" IS NULL OR m."deleted_at" IS NOT NULL)
        ORDER BY l."id" ASC
        LIMIT $2`,
      [teamId, SCAN_MAX_ANOMALIES],
    );
    return rows.map(row =>
      this.detected(
        DataQualityRule.OrphanPoints,
        AnomalyResourceType.LedgerEntry,
        row.resource_ref,
      ),
    );
  }

  /** Analytics projections older than the freshness window. */
  async detectStaleProjections(
    scope: TransactionScope,
    teamId: string,
    staleBefore: Date,
  ): Promise<readonly DetectedAnomaly[]> {
    const rows = await scope.run<DetectedRow>(
      `SELECT p."id"::text AS "resource_ref", 'projection' AS "resource_type",
              '' AS "detail"
         FROM "analytics_projections" p
        WHERE p."team_id" = $1 AND p."computed_at" < $2
        ORDER BY p."computed_at" ASC
        LIMIT $3`,
      [teamId, staleBefore.toISOString(), SCAN_MAX_ANOMALIES],
    );
    return rows.map(row =>
      this.detected(
        DataQualityRule.StaleProjection,
        AnomalyResourceType.Projection,
        row.resource_ref,
      ),
    );
  }

  private detected(
    ruleKey: DataQualityRule,
    resourceType: AnomalyResourceType,
    resourceRef: string,
  ): DetectedAnomaly {
    return { ruleKey, resourceType, resourceRef };
  }
}
