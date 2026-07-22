import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { toRepair } from '../lib/dataquality.mapper';
import { REPAIR_COLUMNS } from '../model/dataquality.constants';
import type { RepairRow } from '../model/dataquality.rows';
import type {
  NewRepair,
  Repair,
  RepairStatusChange,
} from '../model/dataquality.types';

/**
 * Persistence for repairs. Data access only: parameterized SQL, static column
 * lists, and optimistic-version-guarded status writes. A repair row is the
 * audit trail of a preview → apply → (rollback) sequence — never the mutation
 * itself, which runs through the owning domain service.
 */
@Injectable()
export class RepairRepository {
  async insert(scope: TransactionScope, repair: NewRepair): Promise<Repair> {
    const rows = await scope.run<RepairRow>(
      `INSERT INTO "data_quality_repairs"
        ("id", "team_id", "anomaly_id", "repair_kind", "impact_count",
         "impact_summary", "requested_by", "created_at", "updated_at")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
       RETURNING ${REPAIR_COLUMNS}`,
      [
        repair.id,
        repair.teamId,
        repair.anomalyId,
        repair.repairKind,
        repair.impactCount,
        repair.impactSummary,
        repair.requestedBy,
        repair.now.toISOString(),
      ],
    );
    const row = rows[0];
    if (row === undefined) {
      throw new Error('Expected a returned row from the repair write');
    }
    return toRepair(row);
  }

  async findForWrite(
    scope: TransactionScope,
    teamId: string,
    repairId: string,
  ): Promise<Repair | null> {
    const rows = await scope.run<RepairRow>(
      `SELECT ${REPAIR_COLUMNS} FROM "data_quality_repairs"
        WHERE "id" = $1 AND "team_id" = $2`,
      [repairId, teamId],
    );
    const row = rows[0];
    return row === undefined ? null : toRepair(row);
  }

  /** The latest repair recorded for an anomaly, if any. */
  async findLatestForAnomaly(
    scope: TransactionScope,
    teamId: string,
    anomalyId: string,
  ): Promise<Repair | null> {
    const rows = await scope.run<RepairRow>(
      `SELECT ${REPAIR_COLUMNS} FROM "data_quality_repairs"
        WHERE "team_id" = $1 AND "anomaly_id" = $2
        ORDER BY "created_at" DESC, "id" DESC
        LIMIT 1`,
      [teamId, anomalyId],
    );
    const row = rows[0];
    return row === undefined ? null : toRepair(row);
  }

  async applyStatusChange(
    scope: TransactionScope,
    change: RepairStatusChange,
  ): Promise<Repair | null> {
    const rows = await scope.run<RepairRow>(
      `UPDATE "data_quality_repairs"
          SET "status" = $4, "rollback_ref" = $5, "applied_at" = $6,
              "rolled_back_at" = $7, "updated_at" = $8,
              "record_version" = "record_version" + 1
        WHERE "id" = $1 AND "team_id" = $2 AND "record_version" = $3
       RETURNING ${REPAIR_COLUMNS}`,
      [
        change.id,
        change.teamId,
        change.expectedRecordVersion,
        change.toStatus,
        change.rollbackRef,
        change.appliedAt === null ? null : change.appliedAt.toISOString(),
        change.rolledBackAt === null ? null : change.rolledBackAt.toISOString(),
        change.now.toISOString(),
      ],
    );
    const row = rows[0];
    return row === undefined ? null : toRepair(row);
  }
}
