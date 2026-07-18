import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Practice attendance schema (module 202). Attendance is the AUDITABLE record of who
 * took part — separate from RSVP intention (201) and from any computed score (the
 * versioned engine is 303; this module only stores raw facts + INPUTS). Four tables:
 *
 *   - attendance_scoring_rules      versioned weights/penalties/denominator policy.
 *                                   Seeded with ONE legacy-CANDIDATE rule (Practice 3,
 *                                   Fitness 2, Game 3, Throwing 4; late/absent penalty
 *                                   as explicit components) — data, not constants, and
 *                                   never adopted as final policy without approval.
 *   - attendance_sheets             the per-session OPEN → FINALIZED → CORRECTED
 *                                   finalization row (unique session_id) with the
 *                                   finalize actor/instant + an optimistic version.
 *   - attendance_records            the single EFFECTIVE record per member/session
 *                                   (partial-free unique index on session+membership):
 *                                   status, check-in/out, lateness (null-not-zero),
 *                                   excuse category, restricted note, evidence ref,
 *                                   source, recorder, and an optimistic version.
 *   - attendance_record_revisions   append-only history of every mark / self check-in
 *                                   / privileged correction (with reason). Never
 *                                   updated or deleted.
 *
 * Conventions (docs/database.md): UUID PKs via pgcrypto gen_random_uuid(),
 * timestamptz in UTC, snake_case, created_at/updated_at + created_by/updated_by
 * audit columns, optimistic version on mutable aggregates, check constraints
 * mirroring the enums (and the null-not-zero cross-field invariants), bounded
 * indexes. Fully reversible: down drops exactly what up created, in dependency order.
 */
export class AttendanceSchema1722000000000 implements MigrationInterface {
  name = 'AttendanceSchema1722000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await this.createScoringRules(queryRunner);
    await this.seedLegacyRule(queryRunner);
    await this.createSheets(queryRunner);
    await this.createRecords(queryRunner);
    await this.createRevisions(queryRunner);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TABLE IF EXISTS "attendance_record_revisions"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "attendance_records"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "attendance_sheets"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "attendance_scoring_rules"`);
  }

  private async createScoringRules(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "attendance_scoring_rules" (
        "code" text PRIMARY KEY,
        "label" text NOT NULL,
        "status" text NOT NULL DEFAULT 'candidate',
        "weights" jsonb NOT NULL,
        "default_weight" integer NOT NULL DEFAULT 1,
        "late_penalty" integer NOT NULL DEFAULT 1,
        "absent_penalty" integer NOT NULL DEFAULT 1,
        "excused_excluded" boolean NOT NULL DEFAULT true,
        "is_default" boolean NOT NULL DEFAULT false,
        "effective_from" timestamptz NOT NULL DEFAULT now(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "ck_attendance_rule_status" CHECK ("status" IN
          ('candidate', 'approved'))
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_attendance_rule_default"
         ON "attendance_scoring_rules" ("is_default")
        WHERE "is_default" = true`,
    );
  }

  private async seedLegacyRule(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "attendance_scoring_rules" ("code", "label", "status",
              "weights", "default_weight", "late_penalty", "absent_penalty",
              "excused_excluded", "is_default")
      VALUES ('legacy-candidate-v1', 'Legacy candidate weights', 'candidate',
              '{"practice": 3, "fitness": 2, "game": 3, "throwing": 4}'::jsonb,
              1, 1, 1, true, true)
    `);
  }

  private async createSheets(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "attendance_sheets" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "session_id" uuid NOT NULL REFERENCES "practice_sessions" ("id")
          ON DELETE CASCADE,
        "team_id" uuid NOT NULL REFERENCES "teams" ("id") ON DELETE CASCADE,
        "season_id" uuid REFERENCES "seasons" ("id") ON DELETE SET NULL,
        "state" text NOT NULL DEFAULT 'open',
        "finalized_at" timestamptz,
        "finalized_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "created_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "updated_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "version" integer NOT NULL DEFAULT 1,
        CONSTRAINT "ck_attendance_sheet_state" CHECK ("state" IN
          ('open', 'finalized', 'corrected'))
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_attendance_sheets_session"
         ON "attendance_sheets" ("session_id")`,
    );
  }

  private async createRecords(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "attendance_records" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "sheet_id" uuid NOT NULL REFERENCES "attendance_sheets" ("id")
          ON DELETE CASCADE,
        "session_id" uuid NOT NULL REFERENCES "practice_sessions" ("id")
          ON DELETE CASCADE,
        "team_id" uuid NOT NULL REFERENCES "teams" ("id") ON DELETE CASCADE,
        "season_id" uuid REFERENCES "seasons" ("id") ON DELETE SET NULL,
        "membership_id" uuid NOT NULL REFERENCES "memberships" ("id")
          ON DELETE CASCADE,
        "user_id" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "status" text NOT NULL,
        "check_in_at" timestamptz,
        "check_out_at" timestamptz,
        "lateness_minutes" integer,
        "excuse_category" text,
        "note" text,
        "evidence_ref" text,
        "source" text NOT NULL DEFAULT 'coach',
        "recorded_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "recorded_at" timestamptz NOT NULL DEFAULT now(),
        "created_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "updated_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "version" integer NOT NULL DEFAULT 1,
        CONSTRAINT "ck_attendance_status" CHECK ("status" IN
          ('present_on_time', 'present_late', 'excused', 'injured', 'absent',
           'remote_approved', 'other_approved')),
        CONSTRAINT "ck_attendance_source" CHECK ("source" IN
          ('self', 'coach', 'admin', 'import', 'system')),
        CONSTRAINT "ck_attendance_excuse_category" CHECK ("excuse_category" IS
          NULL OR "excuse_category" IN
          ('injury', 'illness', 'work', 'travel', 'personal', 'other')),
        CONSTRAINT "ck_attendance_lateness_nonneg" CHECK ("lateness_minutes" IS
          NULL OR "lateness_minutes" >= 0),
        CONSTRAINT "ck_attendance_lateness_late" CHECK ("lateness_minutes" IS
          NULL OR "status" = 'present_late'),
        CONSTRAINT "ck_attendance_excuse_status" CHECK ("excuse_category" IS NULL
          OR "status" IN ('excused', 'injured'))
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_attendance_records_session_membership"
         ON "attendance_records" ("session_id", "membership_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_attendance_records_sheet"
         ON "attendance_records" ("sheet_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_attendance_records_team_membership"
         ON "attendance_records" ("team_id", "membership_id")`,
    );
  }

  private async createRevisions(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "attendance_record_revisions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "record_id" uuid NOT NULL REFERENCES "attendance_records" ("id")
          ON DELETE CASCADE,
        "session_id" uuid NOT NULL REFERENCES "practice_sessions" ("id")
          ON DELETE CASCADE,
        "membership_id" uuid NOT NULL REFERENCES "memberships" ("id")
          ON DELETE CASCADE,
        "from_status" text,
        "to_status" text NOT NULL,
        "lateness_minutes" integer,
        "excuse_category" text,
        "source" text NOT NULL,
        "is_correction" boolean NOT NULL DEFAULT false,
        "correction_reason" text,
        "actor_user_id" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "occurred_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "ck_attendance_rev_to_status" CHECK ("to_status" IN
          ('present_on_time', 'present_late', 'excused', 'injured', 'absent',
           'remote_approved', 'other_approved')),
        CONSTRAINT "ck_attendance_rev_source" CHECK ("source" IN
          ('self', 'coach', 'admin', 'import', 'system'))
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_attendance_revisions_record"
         ON "attendance_record_revisions" ("record_id", "occurred_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_attendance_revisions_session_membership"
         ON "attendance_record_revisions" ("session_id", "membership_id",
           "occurred_at")`,
    );
  }
}
