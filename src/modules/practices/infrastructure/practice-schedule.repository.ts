import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import {
  parseFrequency,
  parseScheduleStatus,
  parseVisibility,
  toDate,
} from '../lib/practices.helpers';
import { SCHEDULE_COLUMNS } from '../model/practices.constants';
import type { CountRow, ScheduleRow } from '../model/practices.rows';
import type {
  ListSchedulesResult,
  NewSchedule,
  PageRequest,
  PracticeSchedule,
  ScheduleUpdate,
} from '../model/practices.types';

/**
 * Persistence for the practice-schedule (recurring template) aggregate.
 * Team-scoped, parameterized, bounded, and deterministically ordered. Array
 * columns (weekdays, exceptions) round-trip as native arrays; date-only horizon
 * bounds are read as calendar strings. Optimistic concurrency is enforced by a
 * version predicate on every mutating write.
 */
@Injectable()
export class PracticeScheduleRepository {
  async insert(
    scope: TransactionScope,
    schedule: NewSchedule,
  ): Promise<PracticeSchedule> {
    const rows = await scope.run<ScheduleRow>(
      `INSERT INTO "practice_schedules" ("id", "team_id", "season_id", "name",
              "session_type", "timezone", "frequency", "interval_weeks",
              "weekdays", "start_time_local", "duration_minutes",
              "meet_offset_minutes", "rsvp_cutoff_minutes", "default_venue_id",
              "default_field", "default_capacity", "visibility",
              "organizer_user_id", "notes", "generation_start",
              "generation_until", "exceptions", "created_by", "created_at",
              "updated_at")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
              $16, $17, $18, $19, $20, $21, $22, $23, $24, $24)
       RETURNING ${SCHEDULE_COLUMNS}`,
      this.insertParams(schedule),
    );
    return this.toSchedule(this.requireRow(rows));
  }

  private insertParams(schedule: NewSchedule): readonly unknown[] {
    return [
      schedule.id,
      schedule.teamId,
      schedule.seasonId,
      schedule.name,
      schedule.sessionType,
      schedule.timezone,
      schedule.frequency,
      schedule.intervalWeeks,
      schedule.weekdays,
      schedule.startTimeLocal,
      schedule.durationMinutes,
      schedule.meetOffsetMinutes,
      schedule.rsvpCutoffMinutes,
      schedule.defaultVenueId,
      schedule.defaultField,
      schedule.defaultCapacity,
      schedule.visibility,
      schedule.organizerUserId,
      schedule.notes,
      schedule.generationStart,
      schedule.generationUntil,
      schedule.exceptions,
      schedule.createdBy,
      schedule.now.toISOString(),
    ];
  }

  async findByIdInTeam(
    scope: TransactionScope,
    teamId: string,
    id: string,
  ): Promise<PracticeSchedule | null> {
    const rows = await scope.run<ScheduleRow>(
      `SELECT ${SCHEDULE_COLUMNS} FROM "practice_schedules"
        WHERE "id" = $1 AND "team_id" = $2`,
      [id, teamId],
    );
    const row = rows[0];
    return row === undefined ? null : this.toSchedule(row);
  }

  async update(
    scope: TransactionScope,
    update: ScheduleUpdate,
  ): Promise<PracticeSchedule | null> {
    const rows = await scope.run<ScheduleRow>(
      `UPDATE "practice_schedules"
          SET "season_id" = $3, "name" = $4, "session_type" = $5,
              "timezone" = $6, "frequency" = $7, "interval_weeks" = $8,
              "weekdays" = $9, "start_time_local" = $10, "duration_minutes" = $11,
              "meet_offset_minutes" = $12, "rsvp_cutoff_minutes" = $13,
              "default_venue_id" = $14, "default_field" = $15,
              "default_capacity" = $16, "visibility" = $17,
              "organizer_user_id" = $18, "notes" = $19, "generation_start" = $20,
              "generation_until" = $21, "exceptions" = $22, "status" = $23,
              "updated_by" = $24, "updated_at" = $25, "version" = "version" + 1
        WHERE "id" = $1 AND "team_id" = $2 AND "version" = $26
       RETURNING ${SCHEDULE_COLUMNS}`,
      this.updateParams(update),
    );
    const row = rows[0];
    return row === undefined ? null : this.toSchedule(row);
  }

  private updateParams(update: ScheduleUpdate): readonly unknown[] {
    return [
      update.id,
      update.teamId,
      update.seasonId,
      update.name,
      update.sessionType,
      update.timezone,
      update.frequency,
      update.intervalWeeks,
      update.weekdays,
      update.startTimeLocal,
      update.durationMinutes,
      update.meetOffsetMinutes,
      update.rsvpCutoffMinutes,
      update.defaultVenueId,
      update.defaultField,
      update.defaultCapacity,
      update.visibility,
      update.organizerUserId,
      update.notes,
      update.generationStart,
      update.generationUntil,
      update.exceptions,
      update.status,
      update.updatedBy,
      update.now.toISOString(),
      update.expectedVersion,
    ];
  }

  async archive(
    scope: TransactionScope,
    teamId: string,
    id: string,
    actorId: string | null,
    now: Date,
  ): Promise<PracticeSchedule | null> {
    const rows = await scope.run<ScheduleRow>(
      `UPDATE "practice_schedules"
          SET "status" = 'archived', "updated_by" = $3, "updated_at" = $4,
              "version" = "version" + 1
        WHERE "id" = $1 AND "team_id" = $2 AND "status" = 'active'
       RETURNING ${SCHEDULE_COLUMNS}`,
      [id, teamId, actorId, now.toISOString()],
    );
    const row = rows[0];
    return row === undefined ? null : this.toSchedule(row);
  }

  async list(
    scope: TransactionScope,
    teamId: string,
    page: PageRequest,
  ): Promise<ListSchedulesResult> {
    const rows = await scope.run<ScheduleRow>(
      `SELECT ${SCHEDULE_COLUMNS} FROM "practice_schedules"
        WHERE "team_id" = $1
        ORDER BY "created_at" DESC, "id" ASC
        LIMIT $2 OFFSET $3`,
      [teamId, page.limit, page.offset],
    );
    const counts = await scope.run<CountRow>(
      `SELECT COUNT(*)::int AS "count" FROM "practice_schedules"
        WHERE "team_id" = $1`,
      [teamId],
    );
    return {
      items: rows.map(row => this.toSchedule(row)),
      total: counts[0]?.count ?? 0,
      limit: page.limit,
      offset: page.offset,
    };
  }

  private requireRow(rows: readonly ScheduleRow[]): ScheduleRow {
    const row = rows[0];
    if (row === undefined) {
      throw new Error('Expected a returned row from the schedule write');
    }
    return row;
  }

  private toSchedule(row: ScheduleRow): PracticeSchedule {
    return {
      id: row.id,
      teamId: row.team_id,
      seasonId: row.season_id,
      name: row.name,
      sessionType: row.session_type,
      timezone: row.timezone,
      frequency: parseFrequency(row.frequency),
      intervalWeeks: row.interval_weeks,
      weekdays: row.weekdays,
      startTimeLocal: row.start_time_local,
      durationMinutes: row.duration_minutes,
      meetOffsetMinutes: row.meet_offset_minutes,
      rsvpCutoffMinutes: row.rsvp_cutoff_minutes,
      defaultVenueId: row.default_venue_id,
      defaultField: row.default_field,
      defaultCapacity: row.default_capacity,
      visibility: parseVisibility(row.visibility),
      organizerUserId: row.organizer_user_id,
      notes: row.notes,
      generationStart: row.generation_start,
      generationUntil: row.generation_until,
      exceptions: row.exceptions,
      status: parseScheduleStatus(row.status),
      createdBy: row.created_by,
      updatedBy: row.updated_by,
      createdAt: toDate(row.created_at),
      updatedAt: toDate(row.updated_at),
      version: row.version,
    };
  }
}
