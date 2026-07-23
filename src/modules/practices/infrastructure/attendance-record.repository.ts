import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import {
  parseAttendanceSource,
  parseAttendanceStatus,
  parseExcuseCategory,
  parseNullableAttendanceSource,
  parseNullableAttendanceState,
  parseNullableAttendanceStatus,
  toIsoOrNull,
} from '../lib/attendance.helpers';
import { toDate, toNullableDate } from '../lib/practices.helpers';
import { parseNullableRsvpStatus } from '../lib/rsvp.helpers';
import { ATTENDANCE_RECORD_COLUMNS } from '../model/attendance.constants';
import type {
  AttendanceCountRow,
  AttendanceRecordRow,
  ParticipationFactRow,
  RosterEntryRow,
  SelfHistoryEntryRow,
} from '../model/attendance.rows';
import type {
  AttendanceRecord,
  AttendanceRecordUpdate,
  NewAttendanceRecord,
  ParticipationFact,
  RosterEntry,
  SelfHistoryEntry,
  SelfHistoryScan,
} from '../model/attendance.types';
import { SessionStatus } from '../model/practices.enums';
import type { PageRequest } from '../model/practices.types';

/**
 * Persistence for the effective attendance-record aggregate. Session-scoped,
 * parameterized, bounded, deterministically ordered, static column lists. The first
 * insert uses `ON CONFLICT DO NOTHING` against the (session, membership) unique
 * index so a concurrent duplicate is a clean null the application maps to a version
 * conflict; updates are optimistic-version guarded. The roster read LEFT JOINs
 * active memberships so every rostered member appears (unmarked ⇒ null status —
 * null-not-zero); participation facts are grouped projections from finalized rows.
 */
@Injectable()
export class AttendanceRecordRepository {
  async findBySessionMembership(
    scope: TransactionScope,
    sessionId: string,
    membershipId: string,
  ): Promise<AttendanceRecord | null> {
    const rows = await scope.run<AttendanceRecordRow>(
      `SELECT ${ATTENDANCE_RECORD_COLUMNS} FROM "attendance_records"
        WHERE "session_id" = $1 AND "membership_id" = $2`,
      [sessionId, membershipId],
    );
    const row = rows[0];
    return row === undefined ? null : this.toRecord(row);
  }

  async insert(
    scope: TransactionScope,
    record: NewAttendanceRecord,
  ): Promise<AttendanceRecord | null> {
    const rows = await scope.run<AttendanceRecordRow>(
      `INSERT INTO "attendance_records" ("id", "sheet_id", "session_id",
              "team_id", "season_id", "membership_id", "user_id", "status",
              "check_in_at", "check_out_at", "lateness_minutes", "excuse_category",
              "note", "evidence_ref", "source", "recorded_by", "recorded_at",
              "created_by", "created_at", "updated_at")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
              $16, $17, $18, $19, $19)
       ON CONFLICT ("session_id", "membership_id") DO NOTHING
       RETURNING ${ATTENDANCE_RECORD_COLUMNS}`,
      [
        record.id,
        record.sheetId,
        record.sessionId,
        record.teamId,
        record.seasonId,
        record.membershipId,
        record.userId,
        record.status,
        toIsoOrNull(record.checkInAt),
        toIsoOrNull(record.checkOutAt),
        record.latenessMinutes,
        record.excuseCategory,
        record.note,
        record.evidenceRef,
        record.source,
        record.recordedBy,
        record.recordedAt.toISOString(),
        record.createdBy,
        record.now.toISOString(),
      ],
    );
    const row = rows[0];
    return row === undefined ? null : this.toRecord(row);
  }

  async update(
    scope: TransactionScope,
    update: AttendanceRecordUpdate,
  ): Promise<AttendanceRecord | null> {
    const rows = await scope.run<AttendanceRecordRow>(
      `UPDATE "attendance_records"
          SET "status" = $2, "check_in_at" = $3, "check_out_at" = $4,
              "lateness_minutes" = $5, "excuse_category" = $6, "note" = $7,
              "evidence_ref" = $8, "source" = $9, "recorded_by" = $10,
              "recorded_at" = $11, "updated_by" = $12, "updated_at" = $13,
              "version" = "version" + 1
        WHERE "id" = $1 AND "version" = $14
       RETURNING ${ATTENDANCE_RECORD_COLUMNS}`,
      [
        update.id,
        update.status,
        toIsoOrNull(update.checkInAt),
        toIsoOrNull(update.checkOutAt),
        update.latenessMinutes,
        update.excuseCategory,
        update.note,
        update.evidenceRef,
        update.source,
        update.recordedBy,
        update.recordedAt.toISOString(),
        update.updatedBy,
        update.now.toISOString(),
        update.expectedVersion,
      ],
    );
    const row = rows[0];
    return row === undefined ? null : this.toRecord(row);
  }

  async listRoster(
    scope: TransactionScope,
    teamId: string,
    sessionId: string,
    page: PageRequest,
  ): Promise<readonly RosterEntry[]> {
    const rows = await scope.run<RosterEntryRow>(
      `SELECT m."id" AS "membership_id", m."user_id",
              COALESCE(p."preferred_name", p."full_name", u."display_name",
                       u."email") AS "display_name",
              r."status" AS "rsvp_status", a."status",
              a."check_in_at", a."lateness_minutes", a."excuse_category",
              a."source", a."version"
         FROM "memberships" m
         LEFT JOIN "member_profiles" p ON p."membership_id" = m."id"
         LEFT JOIN "users" u ON u."id" = m."user_id"
         LEFT JOIN "practice_rsvps" r
           ON r."session_id" = $2 AND r."membership_id" = m."id"
         LEFT JOIN "attendance_records" a
           ON a."session_id" = $2 AND a."membership_id" = m."id"
        WHERE m."team_id" = $1 AND m."deleted_at" IS NULL
          AND m."status" = 'active'
        ORDER BY m."id" ASC
        LIMIT $3 OFFSET $4`,
      [teamId, sessionId, page.limit, page.offset],
    );
    return rows.map(row => this.toRosterEntry(row));
  }

  /**
   * A member's own attendance across the team's past (started, not cancelled)
   * sessions, newest first: sessions LEFT-JOINed with the caller's record and
   * the sheet state, so unrecorded sessions appear with null status.
   */
  async selfHistory(
    scope: TransactionScope,
    scan: SelfHistoryScan,
  ): Promise<readonly SelfHistoryEntry[]> {
    const rows = await scope.run<SelfHistoryEntryRow>(
      `SELECT s."id" AS "session_id", s."starts_at", s."ends_at",
              s."session_type", a."status", a."lateness_minutes",
              a."excuse_category", a."source", a."recorded_at",
              sh."state" AS "sheet_state"
         FROM "practice_sessions" s
         LEFT JOIN "attendance_records" a
           ON a."session_id" = s."id" AND a."membership_id" = $2
         LEFT JOIN "attendance_sheets" sh ON sh."session_id" = s."id"
        WHERE s."team_id" = $1 AND s."starts_at" <= $3 AND s."status" <> $4
          AND ($5::uuid IS NULL OR s."season_id" = $5)
        ORDER BY s."starts_at" DESC, s."id" DESC
        LIMIT $6 OFFSET $7`,
      [
        scan.teamId,
        scan.membershipId,
        scan.now.toISOString(),
        SessionStatus.Cancelled,
        scan.seasonId,
        scan.page.limit,
        scan.page.offset,
      ],
    );
    return rows.map(row => this.toSelfHistoryEntry(row));
  }

  async countSelfHistory(
    scope: TransactionScope,
    scan: SelfHistoryScan,
  ): Promise<number> {
    const rows = await scope.run<AttendanceCountRow>(
      `SELECT COUNT(*)::int AS "count" FROM "practice_sessions" s
        WHERE s."team_id" = $1 AND s."starts_at" <= $2 AND s."status" <> $3
          AND ($4::uuid IS NULL OR s."season_id" = $4)`,
      [
        scan.teamId,
        scan.now.toISOString(),
        SessionStatus.Cancelled,
        scan.seasonId,
      ],
    );
    return rows[0]?.count ?? 0;
  }

  async countRoster(scope: TransactionScope, teamId: string): Promise<number> {
    const rows = await scope.run<AttendanceCountRow>(
      `SELECT COUNT(*)::int AS "count" FROM "memberships"
        WHERE "team_id" = $1 AND "deleted_at" IS NULL AND "status" = 'active'`,
      [teamId],
    );
    return rows[0]?.count ?? 0;
  }

  async countBySession(
    scope: TransactionScope,
    sessionId: string,
  ): Promise<number> {
    const rows = await scope.run<AttendanceCountRow>(
      `SELECT COUNT(*)::int AS "count" FROM "attendance_records"
        WHERE "session_id" = $1`,
      [sessionId],
    );
    return rows[0]?.count ?? 0;
  }

  async participationFacts(
    scope: TransactionScope,
    teamId: string,
    membershipId: string,
    seasonId: string | null,
    limit: number,
  ): Promise<readonly ParticipationFact[]> {
    const rows = await scope.run<ParticipationFactRow>(
      `SELECT a."status", s."session_type", COUNT(*)::int AS "count"
         FROM "attendance_records" a
         JOIN "practice_sessions" s ON s."id" = a."session_id"
         JOIN "attendance_sheets" sh ON sh."id" = a."sheet_id"
        WHERE a."team_id" = $1 AND a."membership_id" = $2
          AND sh."state" IN ('finalized', 'corrected')
          AND ($3::uuid IS NULL OR a."season_id" = $3)
        GROUP BY a."status", s."session_type"
        ORDER BY a."status", s."session_type"
        LIMIT $4`,
      [teamId, membershipId, seasonId, limit],
    );
    return rows.map(row => this.toFact(row));
  }

  private toFact(row: ParticipationFactRow): ParticipationFact {
    return {
      status: parseAttendanceStatus(row.status),
      sessionType: row.session_type,
      count: row.count,
    };
  }

  private toRosterEntry(row: RosterEntryRow): RosterEntry {
    return {
      membershipId: row.membership_id,
      userId: row.user_id,
      displayName: row.display_name,
      rsvpStatus: parseNullableRsvpStatus(row.rsvp_status),
      status: parseNullableAttendanceStatus(row.status),
      checkInAt: toNullableDate(row.check_in_at),
      latenessMinutes: row.lateness_minutes,
      excuseCategory: parseExcuseCategory(row.excuse_category),
      source: parseNullableAttendanceSource(row.source),
      version: row.version,
    };
  }

  private toSelfHistoryEntry(row: SelfHistoryEntryRow): SelfHistoryEntry {
    return {
      sessionId: row.session_id,
      startsAt: toDate(row.starts_at),
      endsAt: toDate(row.ends_at),
      sessionType: row.session_type,
      status: parseNullableAttendanceStatus(row.status),
      latenessMinutes: row.lateness_minutes,
      excuseCategory: parseExcuseCategory(row.excuse_category),
      source: parseNullableAttendanceSource(row.source),
      recordedAt: toNullableDate(row.recorded_at),
      sheetState: parseNullableAttendanceState(row.sheet_state),
    };
  }

  private toRecord(row: AttendanceRecordRow): AttendanceRecord {
    return {
      id: row.id,
      sheetId: row.sheet_id,
      sessionId: row.session_id,
      teamId: row.team_id,
      seasonId: row.season_id,
      membershipId: row.membership_id,
      userId: row.user_id,
      status: parseAttendanceStatus(row.status),
      checkInAt: toNullableDate(row.check_in_at),
      checkOutAt: toNullableDate(row.check_out_at),
      latenessMinutes: row.lateness_minutes,
      excuseCategory: parseExcuseCategory(row.excuse_category),
      note: row.note,
      evidenceRef: row.evidence_ref,
      source: parseAttendanceSource(row.source),
      recordedBy: row.recorded_by,
      recordedAt: toDate(row.recorded_at),
      createdBy: row.created_by,
      updatedBy: row.updated_by,
      createdAt: toDate(row.created_at),
      updatedAt: toDate(row.updated_at),
      version: row.version,
    };
  }
}
