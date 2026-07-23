import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import {
  parseSessionStatus,
  parseVisibility,
  toDate,
  toNullableDate,
} from '../lib/practices.helpers';
import { CALENDAR_FEED_PAGE_LIMIT } from '../model/calendar.constants';
import type {
  CalendarFeedSessionCursor,
  CalendarFeedSessionPage,
  CalendarFeedToken,
  CalendarFeedWindow,
} from '../model/calendar.types';
import {
  GENERATED_CONFLICT_CLAUSE,
  SESSION_COLUMNS,
} from '../model/practices.constants';
import { SessionStatus, SessionVisibility } from '../model/practices.enums';
import type {
  CountRow,
  OccurrenceDateRow,
  SessionRow,
} from '../model/practices.rows';
import type {
  ListSessionsResult,
  NewSession,
  PracticeSession,
  SessionDetailsUpdate,
  SessionFilterClause,
  SessionListFilter,
  SessionRescheduleWrite,
  SessionStatusChange,
} from '../model/practices.types';

/**
 * Persistence for the practice-session (occurrence) aggregate. Team-scoped,
 * parameterized, bounded, and deterministically ordered by start instant. Times
 * are stored as UTC timestamptz; the occurrence date is read as a calendar
 * string. Generated occurrences are inserted idempotently — a duplicate
 * (schedule, occurrence-date) is skipped, never overwriting a stable instance.
 */
@Injectable()
export class PracticeSessionRepository {
  async insert(
    scope: TransactionScope,
    session: NewSession,
  ): Promise<PracticeSession> {
    const inserted = await this.runInsert(scope, '', session);
    if (inserted === null) {
      throw new Error('Expected a returned row from the session write');
    }
    return inserted;
  }

  insertGenerated(
    scope: TransactionScope,
    session: NewSession,
  ): Promise<PracticeSession | null> {
    return this.runInsert(scope, GENERATED_CONFLICT_CLAUSE, session);
  }

  async findByIdInTeam(
    scope: TransactionScope,
    teamId: string,
    id: string,
  ): Promise<PracticeSession | null> {
    const rows = await scope.run<SessionRow>(
      `SELECT ${SESSION_COLUMNS} FROM "practice_sessions"
        WHERE "id" = $1 AND "team_id" = $2`,
      [id, teamId],
    );
    const row = rows[0];
    return row === undefined ? null : this.toSession(row);
  }

  async updateDetails(
    scope: TransactionScope,
    update: SessionDetailsUpdate,
  ): Promise<PracticeSession | null> {
    const rows = await scope.run<SessionRow>(
      `UPDATE "practice_sessions"
          SET "venue_id" = $3, "field" = $4, "capacity" = $5, "notes" = $6,
              "visibility" = $7, "updated_by" = $8, "updated_at" = $9,
              "version" = "version" + 1
        WHERE "id" = $1 AND "team_id" = $2 AND "version" = $10
       RETURNING ${SESSION_COLUMNS}`,
      [
        update.id,
        update.teamId,
        update.venueId,
        update.field,
        update.capacity,
        update.notes,
        update.visibility,
        update.updatedBy,
        update.now.toISOString(),
        update.expectedVersion,
      ],
    );
    const row = rows[0];
    return row === undefined ? null : this.toSession(row);
  }

  async reschedule(
    scope: TransactionScope,
    write: SessionRescheduleWrite,
  ): Promise<PracticeSession | null> {
    const rows = await scope.run<SessionRow>(
      `UPDATE "practice_sessions"
          SET "status" = $3, "meet_at" = $4, "starts_at" = $5, "ends_at" = $6,
              "rsvp_cutoff_at" = $7, "venue_id" = $8, "field" = $9,
              "updated_by" = $10, "updated_at" = $11, "version" = "version" + 1
        WHERE "id" = $1 AND "team_id" = $2 AND "version" = $12
       RETURNING ${SESSION_COLUMNS}`,
      [
        write.id,
        write.teamId,
        write.status,
        write.meetAt === null ? null : write.meetAt.toISOString(),
        write.startsAt.toISOString(),
        write.endsAt.toISOString(),
        write.rsvpCutoffAt === null ? null : write.rsvpCutoffAt.toISOString(),
        write.venueId,
        write.field,
        write.updatedBy,
        write.now.toISOString(),
        write.expectedVersion,
      ],
    );
    const row = rows[0];
    return row === undefined ? null : this.toSession(row);
  }

  async applyStatusChange(
    scope: TransactionScope,
    change: SessionStatusChange,
  ): Promise<PracticeSession | null> {
    const rows = await scope.run<SessionRow>(
      `UPDATE "practice_sessions"
          SET "status" = $3, "cancellation_reason" = $4, "updated_by" = $5,
              "updated_at" = $6, "version" = "version" + 1
        WHERE "id" = $1 AND "team_id" = $2 AND "version" = $7
       RETURNING ${SESSION_COLUMNS}`,
      [
        change.id,
        change.teamId,
        change.status,
        change.cancellationReason,
        change.updatedBy,
        change.now.toISOString(),
        change.expectedVersion,
      ],
    );
    const row = rows[0];
    return row === undefined ? null : this.toSession(row);
  }

  async listOccurrenceDates(
    scope: TransactionScope,
    scheduleId: string,
    limit: number,
  ): Promise<readonly string[]> {
    const rows = await scope.run<OccurrenceDateRow>(
      `SELECT to_char("occurrence_date", 'YYYY-MM-DD') AS "occurrence_date"
         FROM "practice_sessions"
        WHERE "schedule_id" = $1 AND "occurrence_date" IS NOT NULL
        ORDER BY "occurrence_date" ASC
        LIMIT $2`,
      [scheduleId, limit],
    );
    return rows.map(row => row.occurrence_date);
  }

  async list(
    scope: TransactionScope,
    teamId: string,
    filter: SessionListFilter,
  ): Promise<ListSessionsResult> {
    const where = this.buildFilter(teamId, filter);
    const limitIndex = where.params.length + 1;
    const rows = await scope.run<SessionRow>(
      `SELECT ${SESSION_COLUMNS} FROM "practice_sessions"
        WHERE ${where.clause}
        ORDER BY "starts_at" ASC, "id" ASC
        LIMIT $${limitIndex} OFFSET $${limitIndex + 1}`,
      [...where.params, filter.limit, filter.offset],
    );
    const counts = await scope.run<CountRow>(
      `SELECT COUNT(*)::int AS "count" FROM "practice_sessions"
        WHERE ${where.clause}`,
      where.params,
    );
    return {
      items: rows.map(row => this.toSession(row)),
      total: counts[0]?.count ?? 0,
      limit: filter.limit,
      offset: filter.offset,
    };
  }

  async listCalendarPage(
    scope: TransactionScope,
    token: CalendarFeedToken,
    window: CalendarFeedWindow,
    cursor: CalendarFeedSessionCursor,
  ): Promise<CalendarFeedSessionPage> {
    const rows = await scope.run<SessionRow>(
      `SELECT ${SESSION_COLUMNS} FROM "practice_sessions"
        WHERE "team_id" = $1
          AND ($2::uuid IS NULL OR "season_id" = $2)
          AND "status" = ANY($3::text[])
          AND "visibility" = ANY($4::text[])
          AND "starts_at" >= $5 AND "starts_at" <= $6
          AND ($7::timestamptz IS NULL OR ("starts_at", "id") > ($7, $8::uuid))
        ORDER BY "starts_at" ASC, "id" ASC
        LIMIT $9`,
      this.calendarParameters(token, window, cursor),
    );
    return this.toCalendarPage(rows);
  }

  private calendarParameters(
    token: CalendarFeedToken,
    window: CalendarFeedWindow,
    cursor: CalendarFeedSessionCursor,
  ): readonly unknown[] {
    return [
      token.teamId,
      token.seasonId,
      [
        SessionStatus.Published,
        SessionStatus.Rescheduled,
        SessionStatus.Cancelled,
      ],
      [SessionVisibility.Team, SessionVisibility.Public],
      window.from.toISOString(),
      window.to.toISOString(),
      cursor.startsAt === null ? null : cursor.startsAt.toISOString(),
      cursor.id,
      CALENDAR_FEED_PAGE_LIMIT,
    ];
  }

  private toCalendarPage(rows: readonly SessionRow[]): CalendarFeedSessionPage {
    const last = rows.at(-1);
    const hasNext =
      rows.length === CALENDAR_FEED_PAGE_LIMIT && last !== undefined;
    return {
      items: rows.map(row => this.toSession(row)),
      nextStartsAt: hasNext ? toDate(last.starts_at) : null,
      nextId: hasNext ? last.id : null,
    };
  }

  private buildFilter(
    teamId: string,
    filter: SessionListFilter,
  ): SessionFilterClause {
    const conditions: string[] = ['"team_id" = $1'];
    const params: unknown[] = [teamId];
    this.pushCondition(conditions, params, '"starts_at" >=', filter.from);
    this.pushCondition(conditions, params, '"starts_at" <=', filter.to);
    this.pushCondition(conditions, params, '"status" =', filter.status);
    this.pushCondition(
      conditions,
      params,
      '"session_type" =',
      filter.sessionType,
    );
    this.pushCondition(conditions, params, '"season_id" =', filter.seasonId);
    this.pushCondition(
      conditions,
      params,
      '"schedule_id" =',
      filter.scheduleId,
    );
    return { clause: conditions.join(' AND '), params };
  }

  private pushCondition(
    conditions: string[],
    params: unknown[],
    predicate: string,
    value: Date | string | null,
  ): void {
    if (value === null) {
      return;
    }
    params.push(value instanceof Date ? value.toISOString() : value);
    conditions.push(`${predicate} $${params.length}`);
  }

  private async runInsert(
    scope: TransactionScope,
    conflictClause: string,
    session: NewSession,
  ): Promise<PracticeSession | null> {
    const rows = await scope.run<SessionRow>(
      `INSERT INTO "practice_sessions" ("id", "team_id", "season_id",
              "schedule_id", "occurrence_date", "session_type", "timezone",
              "venue_id", "field", "capacity", "meet_at", "starts_at", "ends_at",
              "rsvp_cutoff_at", "visibility", "organizer_user_id", "notes",
              "status", "created_by", "created_at", "updated_at")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
              $16, $17, $18, $19, $20, $20)
       ${conflictClause}
       RETURNING ${SESSION_COLUMNS}`,
      this.insertParams(session),
    );
    const row = rows[0];
    return row === undefined ? null : this.toSession(row);
  }

  private insertParams(session: NewSession): readonly unknown[] {
    return [
      session.id,
      session.teamId,
      session.seasonId,
      session.scheduleId,
      session.occurrenceDate,
      session.sessionType,
      session.timezone,
      session.venueId,
      session.field,
      session.capacity,
      session.meetAt === null ? null : session.meetAt.toISOString(),
      session.startsAt.toISOString(),
      session.endsAt.toISOString(),
      session.rsvpCutoffAt === null ? null : session.rsvpCutoffAt.toISOString(),
      session.visibility,
      session.organizerUserId,
      session.notes,
      session.status,
      session.createdBy,
      session.now.toISOString(),
    ];
  }

  private toSession(row: SessionRow): PracticeSession {
    return {
      id: row.id,
      teamId: row.team_id,
      seasonId: row.season_id,
      scheduleId: row.schedule_id,
      occurrenceDate: row.occurrence_date,
      sessionType: row.session_type,
      timezone: row.timezone,
      venueId: row.venue_id,
      field: row.field,
      capacity: row.capacity,
      meetAt: toNullableDate(row.meet_at),
      startsAt: toDate(row.starts_at),
      endsAt: toDate(row.ends_at),
      rsvpCutoffAt: toNullableDate(row.rsvp_cutoff_at),
      visibility: parseVisibility(row.visibility),
      organizerUserId: row.organizer_user_id,
      notes: row.notes,
      status: parseSessionStatus(row.status),
      cancellationReason: row.cancellation_reason,
      createdBy: row.created_by,
      updatedBy: row.updated_by,
      createdAt: toDate(row.created_at),
      updatedAt: toDate(row.updated_at),
      version: row.version,
    };
  }
}
