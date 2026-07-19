import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Physical & skill measurement (UN-304). Three additive tables:
 *
 *   - measurement_protocols  named objective-test definitions (sprint, agility,
 *                            jump, throw, reaction, custom…) carrying a canonical
 *                            unit, a better-higher/lower direction, a best/average/
 *                            latest result policy, instructions, and safety notes.
 *                            A partial unique index allows at most one ACTIVE
 *                            protocol per (team scope, key); a small global catalog
 *                            (team_id NULL) is seeded so every team starts usable.
 *   - measurement_sessions   scheduled/conducted testing sessions per team+season,
 *                            moving scheduled → conducted | cancelled, with an
 *                            optimistic record_version and a soft-delete column.
 *   - measurement_attempts   immutable per-player attempts within a session for a
 *                            protocol. The raw value is kept in the unit it was
 *                            recorded in AND as a converted canonical value; both
 *                            are NULL together for a missing attempt (null-not-zero
 *                            is enforced by a check constraint, never inferred as
 *                            zero). Attempt numbers are unique within a target so a
 *                            concurrent double-submit cannot duplicate an attempt.
 *
 * Conventions: UUID PKs via gen_random_uuid(), timestamptz UTC, snake_case, check
 * constraints mirroring the enums, bounded covering indexes. Fully reversible: the
 * down drops exactly what the up created, in dependency order. Changes no existing
 * table.
 */
export class MeasurementsSchema1722800000000 implements MigrationInterface {
  name = 'MeasurementsSchema1722800000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await this.createProtocols(queryRunner);
    await this.createSessions(queryRunner);
    await this.createAttempts(queryRunner);
    await this.seedGlobalCatalog(queryRunner);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "measurement_attempts"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "measurement_sessions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "measurement_protocols"`);
  }

  private async createProtocols(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "measurement_protocols" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "team_id" uuid REFERENCES "teams" ("id") ON DELETE CASCADE,
        "season_id" uuid REFERENCES "seasons" ("id") ON DELETE SET NULL,
        "protocol_key" text NOT NULL,
        "name" text NOT NULL,
        "description" text,
        "discipline" text NOT NULL,
        "unit" text NOT NULL,
        "direction" text NOT NULL,
        "result_policy" text NOT NULL DEFAULT 'best',
        "instructions" text,
        "safety_notes" text,
        "min_value" numeric,
        "max_value" numeric,
        "status" text NOT NULL DEFAULT 'active',
        "record_version" integer NOT NULL DEFAULT 1,
        "created_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "ck_measurement_protocol_discipline" CHECK ("discipline" IN
          ('speed', 'agility', 'endurance', 'strength_power', 'reaction',
           'throwing_accuracy', 'throwing_distance', 'catching', 'jumping',
           'custom')),
        CONSTRAINT "ck_measurement_protocol_unit" CHECK ("unit" IN
          ('seconds', 'milliseconds', 'meters', 'centimeters', 'kilograms',
           'meters_per_second', 'count', 'level', 'percent')),
        CONSTRAINT "ck_measurement_protocol_direction" CHECK ("direction" IN
          ('better_higher', 'better_lower')),
        CONSTRAINT "ck_measurement_protocol_policy" CHECK ("result_policy" IN
          ('best', 'average', 'latest')),
        CONSTRAINT "ck_measurement_protocol_status" CHECK ("status" IN
          ('active', 'archived')),
        CONSTRAINT "ck_measurement_protocol_version" CHECK ("record_version" > 0),
        CONSTRAINT "ck_measurement_protocol_bounds"
          CHECK ("min_value" IS NULL OR "max_value" IS NULL
                 OR "min_value" < "max_value")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_measurement_protocol_key"
         ON "measurement_protocols"
          (COALESCE("team_id", '00000000-0000-0000-0000-000000000000'::uuid),
           "protocol_key")
        WHERE "status" = 'active'`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_measurement_protocols_scope"
         ON "measurement_protocols" ("team_id", "status", "protocol_key")`,
    );
  }

  private async createSessions(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "measurement_sessions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "team_id" uuid NOT NULL REFERENCES "teams" ("id") ON DELETE CASCADE,
        "season_id" uuid REFERENCES "seasons" ("id") ON DELETE SET NULL,
        "title" text NOT NULL,
        "status" text NOT NULL DEFAULT 'scheduled',
        "scheduled_at" timestamptz NOT NULL,
        "conducted_at" timestamptz,
        "location" text,
        "conditions" text,
        "notes" text,
        "record_version" integer NOT NULL DEFAULT 1,
        "created_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,
        CONSTRAINT "ck_measurement_session_status" CHECK ("status" IN
          ('scheduled', 'conducted', 'cancelled')),
        CONSTRAINT "ck_measurement_session_version" CHECK ("record_version" > 0)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_measurement_sessions_team_schedule"
         ON "measurement_sessions"
          ("team_id", "status", "scheduled_at" DESC, "id")
        WHERE "deleted_at" IS NULL`,
    );
  }

  private async createAttempts(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "measurement_attempts" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "session_id" uuid NOT NULL REFERENCES "measurement_sessions" ("id")
          ON DELETE CASCADE,
        "team_id" uuid NOT NULL REFERENCES "teams" ("id") ON DELETE CASCADE,
        "membership_id" uuid NOT NULL REFERENCES "memberships" ("id")
          ON DELETE CASCADE,
        "protocol_id" uuid NOT NULL REFERENCES "measurement_protocols" ("id")
          ON DELETE CASCADE,
        "attempt_number" integer NOT NULL,
        "raw_value" numeric,
        "unit" text NOT NULL,
        "canonical_value" numeric,
        "valid" boolean NOT NULL DEFAULT true,
        "disqualified" boolean NOT NULL DEFAULT false,
        "dq_reason" text,
        "evaluator_user_id" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "notes" text,
        "recorded_at" timestamptz NOT NULL DEFAULT now(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "ck_measurement_attempt_number" CHECK ("attempt_number" > 0),
        CONSTRAINT "ck_measurement_attempt_unit" CHECK ("unit" IN
          ('seconds', 'milliseconds', 'meters', 'centimeters', 'kilograms',
           'meters_per_second', 'count', 'level', 'percent')),
        CONSTRAINT "ck_measurement_attempt_null_not_zero"
          CHECK (("raw_value" IS NULL) = ("canonical_value" IS NULL))
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_measurement_attempt_ordinal"
         ON "measurement_attempts"
          ("session_id", "membership_id", "protocol_id", "attempt_number")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_measurement_attempts_history"
         ON "measurement_attempts"
          ("team_id", "membership_id", "protocol_id", "recorded_at" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_measurement_attempts_session"
         ON "measurement_attempts" ("session_id", "protocol_id")`,
    );
  }

  private async seedGlobalCatalog(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "measurement_protocols"
        ("id", "team_id", "protocol_key", "name", "description", "discipline",
         "unit", "direction", "result_policy", "instructions", "safety_notes")
      VALUES
        ('30400000-0000-4000-9000-000000000001', NULL, 'sprint_20m',
         '20 m sprint', 'Timed 20-metre sprint from a standing start.', 'speed',
         'seconds', 'better_lower', 'best',
         'Two-point stance, no rocking start. Record the fastest of the timed runs.',
         'Full warm-up required; stop on any tightness or strain.'),
        ('30400000-0000-4000-9000-000000000002', NULL, 'pro_agility',
         '5-10-5 pro agility', 'Change-of-direction agility shuttle.', 'agility',
         'seconds', 'better_lower', 'best',
         'Touch each line by hand. Best valid trial counts.',
         'Ensure a non-slip surface and adequate run-off space.'),
        ('30400000-0000-4000-9000-000000000003', NULL, 'vertical_jump',
         'Vertical jump', 'Counter-movement vertical jump height.', 'jumping',
         'centimeters', 'better_higher', 'best',
         'No step into the jump. Record the highest of three attempts.',
         'Land softly on both feet; skip if lower-limb pain is present.'),
        ('30400000-0000-4000-9000-000000000004', NULL, 'beep_test',
         'Multi-stage fitness test', 'Progressive 20 m shuttle endurance level.',
         'endurance', 'level', 'better_higher', 'latest',
         'Record the last completed stage.level reached.',
         'Stop at volitional exhaustion; hydration mandatory.'),
        ('30400000-0000-4000-9000-000000000005', NULL, 'backhand_distance',
         'Backhand distance', 'Maximum backhand throw distance.',
         'throwing_distance', 'meters', 'better_higher', 'best',
         'Measure to first ground contact. Best of the valid throws.',
         'Shoulder warm-up required before maximal throws.'),
        ('30400000-0000-4000-9000-000000000006', NULL, 'reaction_time',
         'Simple reaction time', 'Visual stimulus simple reaction time.',
         'reaction', 'milliseconds', 'better_lower', 'average',
         'Average of the valid trials after discarding false starts.',
         NULL)
      ON CONFLICT DO NOTHING
    `);
  }
}
