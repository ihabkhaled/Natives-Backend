import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { toAnomaly } from '../lib/dataquality.mapper';
import {
  ANOMALY_COLUMNS,
  ANOMALY_UPSERT_SQL,
  LIST_MAX_LIMIT,
} from '../model/dataquality.constants';
import type {
  AnomalyRow,
  DataQualityCountRow,
  DataQualityIdRow,
} from '../model/dataquality.rows';
import type {
  Anomaly,
  AnomalyListFilter,
  AnomalyStatusChange,
  AnomalyUpsert,
  PageRequest,
} from '../model/dataquality.types';

/**
 * Persistence for the anomaly queue. Data access only: parameterized SQL, static
 * column lists, optimistic-version-guarded lifecycle writes, and bounded reads.
 *
 * The upsert is keyed by the anomaly fingerprint: re-detecting the same finding
 * bumps its last-seen and occurrence count and reopens a resolved/expired one
 * rather than piling up duplicates — a finding is never silently closed while
 * the data is still wrong.
 */
@Injectable()
export class AnomalyRepository {
  async upsert(
    scope: TransactionScope,
    anomaly: AnomalyUpsert,
  ): Promise<Anomaly> {
    const rows = await scope.run<AnomalyRow>(ANOMALY_UPSERT_SQL, [
      anomaly.id,
      anomaly.teamId,
      anomaly.ruleKey,
      anomaly.ruleVersion,
      anomaly.severity,
      anomaly.resourceType,
      anomaly.resourceRef,
      anomaly.fingerprint,
      anomaly.now.toISOString(),
    ]);
    const row = rows[0];
    if (row === undefined) {
      throw new Error('Expected a returned row from the anomaly write');
    }
    return toAnomaly(row);
  }

  async findForWrite(
    scope: TransactionScope,
    teamId: string,
    anomalyId: string,
  ): Promise<Anomaly | null> {
    const rows = await scope.run<AnomalyRow>(
      `SELECT ${ANOMALY_COLUMNS} FROM "data_quality_anomalies"
        WHERE "id" = $1 AND "team_id" = $2`,
      [anomalyId, teamId],
    );
    const row = rows[0];
    return row === undefined ? null : toAnomaly(row);
  }

  async applyStatusChange(
    scope: TransactionScope,
    change: AnomalyStatusChange,
  ): Promise<Anomaly | null> {
    const rows = await scope.run<AnomalyRow>(
      `UPDATE "data_quality_anomalies"
          SET "status" = $4, "owner_user_id" = $5, "resolution" = $6,
              "suppressed_until" = $7, "resolved_at" = $8, "updated_at" = $9,
              "record_version" = "record_version" + 1
        WHERE "id" = $1 AND "team_id" = $2 AND "record_version" = $3
       RETURNING ${ANOMALY_COLUMNS}`,
      [
        change.id,
        change.teamId,
        change.expectedRecordVersion,
        change.toStatus,
        change.ownerUserId,
        change.resolution,
        change.suppressedUntil === null
          ? null
          : change.suppressedUntil.toISOString(),
        change.resolvedAt === null ? null : change.resolvedAt.toISOString(),
        change.now.toISOString(),
      ],
    );
    const row = rows[0];
    return row === undefined ? null : toAnomaly(row);
  }

  async listForScope(
    scope: TransactionScope,
    teamId: string,
    filter: AnomalyListFilter,
    page: PageRequest,
  ): Promise<readonly Anomaly[]> {
    const rows = await scope.run<AnomalyRow>(
      `SELECT ${ANOMALY_COLUMNS} FROM "data_quality_anomalies"
        WHERE ${this.predicate()}
        ORDER BY "last_seen_at" DESC, "id" ASC
        LIMIT $5 OFFSET $6`,
      [
        ...this.filterParameters(teamId, filter),
        Math.min(page.limit, LIST_MAX_LIMIT),
        page.offset,
      ],
    );
    return rows.map(row => toAnomaly(row));
  }

  async countForScope(
    scope: TransactionScope,
    teamId: string,
    filter: AnomalyListFilter,
  ): Promise<number> {
    const rows = await scope.run<DataQualityCountRow>(
      `SELECT COUNT(*)::int AS "count" FROM "data_quality_anomalies"
        WHERE ${this.predicate()}`,
      this.filterParameters(teamId, filter),
    );
    return Number(rows[0]?.count ?? 0);
  }

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

  private predicate(): string {
    return `"team_id" = $1
          AND ($2::text IS NULL OR "rule_key" = $2)
          AND ($3::text IS NULL OR "severity" = $3)
          AND ($4::text IS NULL OR "status" = $4)`;
  }

  private filterParameters(
    teamId: string,
    filter: AnomalyListFilter,
  ): readonly unknown[] {
    return [teamId, filter.ruleKey, filter.severity, filter.status];
  }
}
