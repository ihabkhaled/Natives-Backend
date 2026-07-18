import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Practices schema: recurring schedule templates, the stable session instances
 * generated from them, and an append-only session status history:
 *
 *   - practice_schedules              recurring/one-off template: recurrence
 *                                     (frequency/interval/weekdays), a local start
 *                                     time + duration in an explicit timezone
 *                                     (Africa/Cairo default), meet/RSVP offsets,
 *                                     defaults (venue/field/capacity/visibility/
 *                                     organizer), a bounded generation horizon, and
 *                                     exception dates. A template is NOT a session.
 *   - practice_sessions               concrete occurrence: UTC meet/start/end +
 *                                     RSVP cutoff instants, venue/field/capacity,
 *                                     visibility, organizer, status + cancellation
 *                                     reason. A generated occurrence carries its
 *                                     schedule id + local occurrence date; a partial
 *                                     unique index makes generation idempotent and
 *                                     stops a re-run from rewriting a stable
 *                                     instance. Cancellation is a status change, so
 *                                     RSVP/attendance history (added by later
 *                                     modules via FKs onto this row) is preserved.
 *   - practice_session_status_events  immutable publish/reschedule/cancel/reopen
 *                                     history (never updated or deleted).
 *
 * Conventions (docs/database.md): UUID PKs via pgcrypto gen_random_uuid(),
 * timestamptz in UTC, date-only occurrence/horizon columns, snake_case,
 * created_at/updated_at audit columns, created_by/updated_by actor columns,
 * optimistic version on the mutable schedule/session aggregates, check constraints
 * mirroring the enums, bounded indexes. Fully reversible: down drops exactly what
 * up created, in dependency order.
 */
export class PracticesSchema1721800000000 implements MigrationInterface {
  name = 'PracticesSchema1721800000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await this.createSchedules(queryRunner);
    await this.createSessions(queryRunner);
    await this.createStatusEvents(queryRunner);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TABLE IF EXISTS "practice_session_status_events"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "practice_sessions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "practice_schedules"`);
  }

  private async createSchedules(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "practice_schedules" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "team_id" uuid NOT NULL REFERENCES "teams" ("id") ON DELETE CASCADE,
        "season_id" uuid REFERENCES "seasons" ("id") ON DELETE SET NULL,
        "name" text NOT NULL,
        "session_type" text NOT NULL,
        "timezone" text NOT NULL DEFAULT 'Africa/Cairo',
        "frequency" text NOT NULL,
        "interval_weeks" integer NOT NULL DEFAULT 1,
        "weekdays" integer[] NOT NULL DEFAULT '{}',
        "start_time_local" text NOT NULL,
        "duration_minutes" integer NOT NULL,
        "meet_offset_minutes" integer,
        "rsvp_cutoff_minutes" integer,
        "default_venue_id" uuid REFERENCES "venues" ("id") ON DELETE SET NULL,
        "default_field" text,
        "default_capacity" integer,
        "visibility" text NOT NULL DEFAULT 'team',
        "organizer_user_id" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "notes" text,
        "generation_start" date NOT NULL,
        "generation_until" date NOT NULL,
        "exceptions" text[] NOT NULL DEFAULT '{}',
        "status" text NOT NULL DEFAULT 'active',
        "created_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "updated_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "version" integer NOT NULL DEFAULT 1,
        CONSTRAINT "ck_schedule_frequency" CHECK ("frequency" IN
          ('weekly', 'one_off')),
        CONSTRAINT "ck_schedule_visibility" CHECK ("visibility" IN
          ('team', 'coaches', 'public')),
        CONSTRAINT "ck_schedule_status" CHECK ("status" IN
          ('active', 'archived')),
        CONSTRAINT "ck_schedule_interval" CHECK ("interval_weeks" >= 1),
        CONSTRAINT "ck_schedule_duration" CHECK ("duration_minutes" > 0),
        CONSTRAINT "ck_schedule_capacity" CHECK ("default_capacity" IS NULL
          OR "default_capacity" >= 0),
        CONSTRAINT "ck_schedule_horizon" CHECK
          ("generation_until" >= "generation_start")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_schedules_team_status"
         ON "practice_schedules" ("team_id", "status")`,
    );
  }

  private async createSessions(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "practice_sessions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "team_id" uuid NOT NULL REFERENCES "teams" ("id") ON DELETE CASCADE,
        "season_id" uuid REFERENCES "seasons" ("id") ON DELETE SET NULL,
        "schedule_id" uuid REFERENCES "practice_schedules" ("id")
          ON DELETE SET NULL,
        "occurrence_date" date,
        "session_type" text NOT NULL,
        "timezone" text NOT NULL DEFAULT 'Africa/Cairo',
        "venue_id" uuid REFERENCES "venues" ("id") ON DELETE SET NULL,
        "field" text,
        "capacity" integer,
        "meet_at" timestamptz,
        "starts_at" timestamptz NOT NULL,
        "ends_at" timestamptz NOT NULL,
        "rsvp_cutoff_at" timestamptz,
        "visibility" text NOT NULL DEFAULT 'team',
        "organizer_user_id" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "notes" text,
        "status" text NOT NULL DEFAULT 'draft',
        "cancellation_reason" text,
        "created_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "updated_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "version" integer NOT NULL DEFAULT 1,
        CONSTRAINT "ck_session_visibility" CHECK ("visibility" IN
          ('team', 'coaches', 'public')),
        CONSTRAINT "ck_session_status" CHECK ("status" IN
          ('draft', 'published', 'rescheduled', 'cancelled', 'completed',
           'archived')),
        CONSTRAINT "ck_session_capacity" CHECK ("capacity" IS NULL
          OR "capacity" >= 0),
        CONSTRAINT "ck_session_time_order" CHECK ("ends_at" >= "starts_at")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_practice_sessions_schedule_occurrence"
         ON "practice_sessions" ("schedule_id", "occurrence_date")
        WHERE "schedule_id" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_sessions_team_starts"
         ON "practice_sessions" ("team_id", "starts_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_sessions_team_status"
         ON "practice_sessions" ("team_id", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_sessions_schedule"
         ON "practice_sessions" ("schedule_id")
        WHERE "schedule_id" IS NOT NULL`,
    );
  }

  private async createStatusEvents(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "practice_session_status_events" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "session_id" uuid NOT NULL REFERENCES "practice_sessions" ("id")
          ON DELETE CASCADE,
        "from_status" text,
        "to_status" text NOT NULL,
        "reason" text,
        "actor_user_id" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "occurred_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_session_status_events_session"
         ON "practice_session_status_events" ("session_id", "occurred_at")`,
    );
  }
}
