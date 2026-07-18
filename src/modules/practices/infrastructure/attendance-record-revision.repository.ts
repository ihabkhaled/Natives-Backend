import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import {
  parseAttendanceSource,
  parseAttendanceStatus,
  parseExcuseCategory,
  parseNullableAttendanceStatus,
} from '../lib/attendance.helpers';
import { toDate } from '../lib/practices.helpers';
import { ATTENDANCE_REVISION_COLUMNS } from '../model/attendance.constants';
import type { AttendanceRevisionRow } from '../model/attendance.rows';
import type {
  AttendanceRevision,
  NewAttendanceRevision,
} from '../model/attendance.types';

/**
 * Append-only revision history for attendance records. Every mark, self check-in,
 * and privileged correction (with its reason) is recorded as an immutable row in
 * the same transaction as the effective-row write it describes. Reads are bounded
 * and deterministically ordered oldest-first, so correction history survives even
 * after the sheet is finalized.
 */
@Injectable()
export class AttendanceRecordRevisionRepository {
  async append(
    scope: TransactionScope,
    revision: NewAttendanceRevision,
  ): Promise<void> {
    await scope.run(
      `INSERT INTO "attendance_record_revisions" ("id", "record_id",
              "session_id", "membership_id", "from_status", "to_status",
              "lateness_minutes", "excuse_category", "source", "is_correction",
              "correction_reason", "actor_user_id", "occurred_at")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        revision.id,
        revision.recordId,
        revision.sessionId,
        revision.membershipId,
        revision.fromStatus,
        revision.toStatus,
        revision.latenessMinutes,
        revision.excuseCategory,
        revision.source,
        revision.isCorrection,
        revision.correctionReason,
        revision.actorUserId,
        revision.now.toISOString(),
      ],
    );
  }

  async listBySessionMembership(
    scope: TransactionScope,
    sessionId: string,
    membershipId: string,
    limit: number,
  ): Promise<readonly AttendanceRevision[]> {
    const rows = await scope.run<AttendanceRevisionRow>(
      `SELECT ${ATTENDANCE_REVISION_COLUMNS} FROM "attendance_record_revisions"
        WHERE "session_id" = $1 AND "membership_id" = $2
        ORDER BY "occurred_at" ASC, "id" ASC
        LIMIT $3`,
      [sessionId, membershipId, limit],
    );
    return rows.map(row => this.toRevision(row));
  }

  private toRevision(row: AttendanceRevisionRow): AttendanceRevision {
    return {
      id: row.id,
      recordId: row.record_id,
      sessionId: row.session_id,
      membershipId: row.membership_id,
      fromStatus: parseNullableAttendanceStatus(row.from_status),
      toStatus: parseAttendanceStatus(row.to_status),
      latenessMinutes: row.lateness_minutes,
      excuseCategory: parseExcuseCategory(row.excuse_category),
      source: parseAttendanceSource(row.source),
      isCorrection: row.is_correction,
      correctionReason: row.correction_reason,
      actorUserId: row.actor_user_id,
      occurredAt: toDate(row.occurred_at),
    };
  }
}
