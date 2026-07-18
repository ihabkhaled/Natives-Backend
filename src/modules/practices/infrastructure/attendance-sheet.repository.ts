import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { parseAttendanceState } from '../lib/attendance.helpers';
import { toDate, toNullableDate } from '../lib/practices.helpers';
import { ATTENDANCE_SHEET_COLUMNS } from '../model/attendance.constants';
import type { AttendanceSheetRow } from '../model/attendance.rows';
import type {
  AttendanceSheet,
  NewAttendanceSheet,
  SheetCorrection,
  SheetFinalize,
} from '../model/attendance.types';

/**
 * Persistence for the per-session attendance sheet (the OPEN/FINALIZED/CORRECTED
 * finalization row). Session-scoped, parameterized, static column lists. The insert
 * uses `ON CONFLICT DO NOTHING` against the unique `session_id` index so a
 * concurrent create is a clean null the caller resolves by re-reading; finalize and
 * correct are guarded (by version + state) so a lost race never re-locks a sheet.
 */
@Injectable()
export class AttendanceSheetRepository {
  async insertSheet(
    scope: TransactionScope,
    sheet: NewAttendanceSheet,
  ): Promise<AttendanceSheet | null> {
    const rows = await scope.run<AttendanceSheetRow>(
      `INSERT INTO "attendance_sheets" ("id", "session_id", "team_id",
              "season_id", "created_by", "created_at", "updated_at")
       VALUES ($1, $2, $3, $4, $5, $6, $6)
       ON CONFLICT ("session_id") DO NOTHING
       RETURNING ${ATTENDANCE_SHEET_COLUMNS}`,
      [
        sheet.id,
        sheet.sessionId,
        sheet.teamId,
        sheet.seasonId,
        sheet.createdBy,
        sheet.now.toISOString(),
      ],
    );
    const row = rows[0];
    return row === undefined ? null : this.toSheet(row);
  }

  async findBySession(
    scope: TransactionScope,
    sessionId: string,
  ): Promise<AttendanceSheet | null> {
    const rows = await scope.run<AttendanceSheetRow>(
      `SELECT ${ATTENDANCE_SHEET_COLUMNS} FROM "attendance_sheets"
        WHERE "session_id" = $1`,
      [sessionId],
    );
    const row = rows[0];
    return row === undefined ? null : this.toSheet(row);
  }

  async finalize(
    scope: TransactionScope,
    finalize: SheetFinalize,
  ): Promise<AttendanceSheet | null> {
    const rows = await scope.run<AttendanceSheetRow>(
      `UPDATE "attendance_sheets"
          SET "state" = 'finalized', "finalized_at" = $2, "finalized_by" = $3,
              "updated_by" = $3, "updated_at" = $2, "version" = "version" + 1
        WHERE "id" = $1 AND "version" = $4 AND "state" = 'open'
       RETURNING ${ATTENDANCE_SHEET_COLUMNS}`,
      [
        finalize.id,
        finalize.now.toISOString(),
        finalize.finalizedBy,
        finalize.expectedVersion,
      ],
    );
    const row = rows[0];
    return row === undefined ? null : this.toSheet(row);
  }

  async applyCorrection(
    scope: TransactionScope,
    correction: SheetCorrection,
  ): Promise<AttendanceSheet | null> {
    const rows = await scope.run<AttendanceSheetRow>(
      `UPDATE "attendance_sheets"
          SET "state" = 'corrected', "updated_by" = $2, "updated_at" = $3,
              "version" = "version" + 1
        WHERE "id" = $1 AND "state" IN ('finalized', 'corrected')
       RETURNING ${ATTENDANCE_SHEET_COLUMNS}`,
      [correction.id, correction.updatedBy, correction.now.toISOString()],
    );
    const row = rows[0];
    return row === undefined ? null : this.toSheet(row);
  }

  private toSheet(row: AttendanceSheetRow): AttendanceSheet {
    return {
      id: row.id,
      sessionId: row.session_id,
      teamId: row.team_id,
      seasonId: row.season_id,
      state: parseAttendanceState(row.state),
      finalizedAt: toNullableDate(row.finalized_at),
      finalizedBy: row.finalized_by,
      createdBy: row.created_by,
      updatedBy: row.updated_by,
      createdAt: toDate(row.created_at),
      updatedAt: toDate(row.updated_at),
      version: row.version,
    };
  }
}
