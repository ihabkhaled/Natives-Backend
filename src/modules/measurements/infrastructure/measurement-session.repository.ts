import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { toMeasurementSession } from '../lib/measurements.mapper';
import {
  LIST_MAX_LIMIT,
  MEASUREMENT_SESSION_COLUMNS,
} from '../model/measurements.constants';
import type {
  CountRow,
  MeasurementSessionRow,
} from '../model/measurements.rows';
import type {
  MeasurementSession,
  NewSession,
  PageRequest,
  SessionStatusChange,
} from '../model/measurements.types';

/**
 * Persistence for the measurement-session aggregate. Data access only:
 * parameterized SQL, static columns, optimistic-version-guarded status changes,
 * and bounded/ordered reads. Soft-deleted sessions are excluded from every read.
 */
@Injectable()
export class MeasurementSessionRepository {
  async insert(
    scope: TransactionScope,
    session: NewSession,
  ): Promise<MeasurementSession> {
    const rows = await scope.run<MeasurementSessionRow>(
      `INSERT INTO "measurement_sessions"
        ("id", "team_id", "season_id", "title", "status", "scheduled_at",
         "location", "conditions", "notes", "created_by", "created_at",
         "updated_at")
       VALUES ($1, $2, $3, $4, 'scheduled', $5, $6, $7, $8, $9, $10, $10)
       RETURNING ${MEASUREMENT_SESSION_COLUMNS}`,
      this.insertParameters(session),
    );
    return toMeasurementSession(this.requireRow(rows));
  }

  async findForWrite(
    scope: TransactionScope,
    teamId: string,
    sessionId: string,
  ): Promise<MeasurementSession | null> {
    const rows = await scope.run<MeasurementSessionRow>(
      `SELECT ${MEASUREMENT_SESSION_COLUMNS} FROM "measurement_sessions"
        WHERE "id" = $1 AND "team_id" = $2 AND "deleted_at" IS NULL`,
      [sessionId, teamId],
    );
    const row = rows[0];
    return row === undefined ? null : toMeasurementSession(row);
  }

  async applyStatusChange(
    scope: TransactionScope,
    change: SessionStatusChange,
  ): Promise<MeasurementSession | null> {
    const rows = await scope.run<MeasurementSessionRow>(
      `UPDATE "measurement_sessions"
          SET "status" = $4, "conducted_at" = $5, "updated_at" = $6,
              "record_version" = "record_version" + 1
        WHERE "id" = $1 AND "team_id" = $2 AND "record_version" = $3
          AND "deleted_at" IS NULL
       RETURNING ${MEASUREMENT_SESSION_COLUMNS}`,
      this.statusParameters(change),
    );
    const row = rows[0];
    return row === undefined ? null : toMeasurementSession(row);
  }

  async listForTeam(
    scope: TransactionScope,
    teamId: string,
    page: PageRequest,
  ): Promise<readonly MeasurementSession[]> {
    const rows = await scope.run<MeasurementSessionRow>(
      `SELECT ${MEASUREMENT_SESSION_COLUMNS} FROM "measurement_sessions"
        WHERE "team_id" = $1 AND "deleted_at" IS NULL
        ORDER BY "scheduled_at" DESC, "id" ASC
        LIMIT $2 OFFSET $3`,
      [teamId, Math.min(page.limit, LIST_MAX_LIMIT), page.offset],
    );
    return rows.map(row => toMeasurementSession(row));
  }

  async countForTeam(scope: TransactionScope, teamId: string): Promise<number> {
    const rows = await scope.run<CountRow>(
      `SELECT COUNT(*)::int AS "count" FROM "measurement_sessions"
        WHERE "team_id" = $1 AND "deleted_at" IS NULL`,
      [teamId],
    );
    return rows[0]?.count ?? 0;
  }

  private insertParameters(session: NewSession): readonly unknown[] {
    return [
      session.id,
      session.teamId,
      session.content.seasonId,
      session.content.title,
      session.content.scheduledAt,
      session.content.location,
      session.content.conditions,
      session.content.notes,
      session.createdBy,
      session.now.toISOString(),
    ];
  }

  private statusParameters(change: SessionStatusChange): readonly unknown[] {
    return [
      change.id,
      change.teamId,
      change.expectedRecordVersion,
      change.toStatus,
      change.conductedAt === null ? null : change.conductedAt.toISOString(),
      change.now.toISOString(),
    ];
  }

  private requireRow(
    rows: readonly MeasurementSessionRow[],
  ): MeasurementSessionRow {
    const row = rows[0];
    if (row === undefined) {
      throw new Error('Expected a returned row from the session write');
    }
    return row;
  }
}
