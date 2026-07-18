import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Practice agendas + reusable drill catalog schema (module 203). Coaches author
 * a reusable drill library and, per session, an ordered agenda (blocks → stations)
 * with participant groups, then record execution/completion. Six tables map the
 * pack's target logical model (`drill_definitions`, `practice_agendas`,
 * `practice_drills`) onto explicit block/station/group aggregates:
 *
 *   - drill_definitions              reusable catalog entry: category, objective,
 *                                    instructions, equipment[], intensity, default
 *                                    duration, skill tags[], safety, media, and an
 *                                    `active → archived` status (archive-in-use safe:
 *                                    archiving never deletes, so referencing blocks
 *                                    keep a stable historical link). Optimistic
 *                                    version + actor audit.
 *   - practice_agendas               the per-session plan (unique session_id) with a
 *                                    `draft → published → completed` lifecycle, a
 *                                    theme + shared notes, publish/complete
 *                                    actor+instant, and an optimistic version that
 *                                    guards structural edits and reorders.
 *   - practice_agenda_groups         named participant groups within an agenda with
 *                                    an optional assigned coach membership.
 *   - practice_agenda_group_members  membership → group assignment (one group per
 *                                    membership per agenda).
 *   - practice_agenda_blocks         ordered blocks (position): optional drill ref,
 *                                    type, offset/duration, intensity, repetitions,
 *                                    target, shared notes, PRIVATE coach_notes, and
 *                                    a planned/completed/skipped completion state.
 *   - practice_agenda_stations       stations within a block: optional drill/group/
 *                                    coach assignment, repetitions, target, notes,
 *                                    completion.
 *
 * Conventions (docs/database.md): UUID PKs via pgcrypto gen_random_uuid(),
 * timestamptz in UTC, snake_case, created_at/updated_at + created_by/updated_by
 * audit columns, optimistic version on mutable aggregates, check constraints
 * mirroring the enums (and null-not-zero non-negative bounds), bounded indexes.
 * Fully reversible: down drops exactly what up created, in dependency order.
 */
export class PracticeAgendasSchema1722100000000 implements MigrationInterface {
  name = 'PracticeAgendasSchema1722100000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await this.createDrills(queryRunner);
    await this.createAgendas(queryRunner);
    await this.createGroups(queryRunner);
    await this.createGroupMembers(queryRunner);
    await this.createBlocks(queryRunner);
    await this.createStations(queryRunner);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "practice_agenda_stations"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "practice_agenda_blocks"`);
    await queryRunner.query(
      `DROP TABLE IF EXISTS "practice_agenda_group_members"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "practice_agenda_groups"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "practice_agendas"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "drill_definitions"`);
  }

  private async createDrills(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "drill_definitions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "team_id" uuid NOT NULL REFERENCES "teams" ("id") ON DELETE CASCADE,
        "season_id" uuid REFERENCES "seasons" ("id") ON DELETE SET NULL,
        "name" text NOT NULL,
        "category" text NOT NULL,
        "objective" text,
        "instructions" text,
        "equipment" text[] NOT NULL DEFAULT '{}',
        "intensity" text NOT NULL DEFAULT 'moderate',
        "default_duration_minutes" integer,
        "skill_tags" text[] NOT NULL DEFAULT '{}',
        "safety_notes" text,
        "media_url" text,
        "status" text NOT NULL DEFAULT 'active',
        "created_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "updated_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "version" integer NOT NULL DEFAULT 1,
        CONSTRAINT "ck_drill_category" CHECK ("category" IN
          ('warmup', 'conditioning', 'throwing', 'cutting', 'defense', 'offense',
           'scrimmage', 'set_play', 'cooldown', 'other')),
        CONSTRAINT "ck_drill_intensity" CHECK ("intensity" IN
          ('low', 'moderate', 'high', 'max')),
        CONSTRAINT "ck_drill_status" CHECK ("status" IN ('active', 'archived')),
        CONSTRAINT "ck_drill_duration" CHECK ("default_duration_minutes" IS NULL
          OR "default_duration_minutes" > 0)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_drills_team_status"
         ON "drill_definitions" ("team_id", "status")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_drills_team_name_active"
         ON "drill_definitions" ("team_id", "name")
        WHERE "status" = 'active'`,
    );
  }

  private async createAgendas(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "practice_agendas" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "session_id" uuid NOT NULL REFERENCES "practice_sessions" ("id")
          ON DELETE CASCADE,
        "team_id" uuid NOT NULL REFERENCES "teams" ("id") ON DELETE CASCADE,
        "season_id" uuid REFERENCES "seasons" ("id") ON DELETE SET NULL,
        "status" text NOT NULL DEFAULT 'draft',
        "theme" text,
        "notes" text,
        "published_at" timestamptz,
        "published_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "completed_at" timestamptz,
        "completed_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "created_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "updated_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "version" integer NOT NULL DEFAULT 1,
        CONSTRAINT "ck_agenda_status" CHECK ("status" IN
          ('draft', 'published', 'completed'))
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_agendas_session"
         ON "practice_agendas" ("session_id")`,
    );
  }

  private async createGroups(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "practice_agenda_groups" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "agenda_id" uuid NOT NULL REFERENCES "practice_agendas" ("id")
          ON DELETE CASCADE,
        "team_id" uuid NOT NULL REFERENCES "teams" ("id") ON DELETE CASCADE,
        "name" text NOT NULL,
        "color" text,
        "coach_membership_id" uuid REFERENCES "memberships" ("id")
          ON DELETE SET NULL,
        "position" integer NOT NULL DEFAULT 0,
        "notes" text,
        "created_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "updated_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "version" integer NOT NULL DEFAULT 1
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_agenda_groups_agenda"
         ON "practice_agenda_groups" ("agenda_id", "position")`,
    );
  }

  private async createGroupMembers(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "practice_agenda_group_members" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "group_id" uuid NOT NULL REFERENCES "practice_agenda_groups" ("id")
          ON DELETE CASCADE,
        "agenda_id" uuid NOT NULL REFERENCES "practice_agendas" ("id")
          ON DELETE CASCADE,
        "membership_id" uuid NOT NULL REFERENCES "memberships" ("id")
          ON DELETE CASCADE,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_agenda_group_members_agenda_membership"
         ON "practice_agenda_group_members" ("agenda_id", "membership_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_agenda_group_members_group"
         ON "practice_agenda_group_members" ("group_id")`,
    );
  }

  private async createBlocks(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "practice_agenda_blocks" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "agenda_id" uuid NOT NULL REFERENCES "practice_agendas" ("id")
          ON DELETE CASCADE,
        "session_id" uuid NOT NULL REFERENCES "practice_sessions" ("id")
          ON DELETE CASCADE,
        "team_id" uuid NOT NULL REFERENCES "teams" ("id") ON DELETE CASCADE,
        "drill_id" uuid REFERENCES "drill_definitions" ("id")
          ON DELETE SET NULL,
        "position" integer NOT NULL,
        "title" text NOT NULL,
        "block_type" text NOT NULL DEFAULT 'drill',
        "offset_minutes" integer,
        "duration_minutes" integer,
        "intensity" text,
        "repetitions" integer,
        "target" text,
        "completion_status" text NOT NULL DEFAULT 'planned',
        "completed_at" timestamptz,
        "completed_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "notes" text,
        "coach_notes" text,
        "created_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "updated_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "version" integer NOT NULL DEFAULT 1,
        CONSTRAINT "ck_block_type" CHECK ("block_type" IN
          ('warmup', 'drill', 'water_break', 'scrimmage', 'conditioning',
           'cooldown', 'discussion', 'other')),
        CONSTRAINT "ck_block_intensity" CHECK ("intensity" IS NULL OR
          "intensity" IN ('low', 'moderate', 'high', 'max')),
        CONSTRAINT "ck_block_completion" CHECK ("completion_status" IN
          ('planned', 'completed', 'skipped')),
        CONSTRAINT "ck_block_position" CHECK ("position" >= 0),
        CONSTRAINT "ck_block_offset" CHECK ("offset_minutes" IS NULL OR
          "offset_minutes" >= 0),
        CONSTRAINT "ck_block_duration" CHECK ("duration_minutes" IS NULL OR
          "duration_minutes" > 0),
        CONSTRAINT "ck_block_repetitions" CHECK ("repetitions" IS NULL OR
          "repetitions" > 0)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_agenda_blocks_agenda_position"
         ON "practice_agenda_blocks" ("agenda_id", "position")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_agenda_blocks_drill"
         ON "practice_agenda_blocks" ("drill_id")
        WHERE "drill_id" IS NOT NULL`,
    );
  }

  private async createStations(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "practice_agenda_stations" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "block_id" uuid NOT NULL REFERENCES "practice_agenda_blocks" ("id")
          ON DELETE CASCADE,
        "agenda_id" uuid NOT NULL REFERENCES "practice_agendas" ("id")
          ON DELETE CASCADE,
        "team_id" uuid NOT NULL REFERENCES "teams" ("id") ON DELETE CASCADE,
        "drill_id" uuid REFERENCES "drill_definitions" ("id")
          ON DELETE SET NULL,
        "group_id" uuid REFERENCES "practice_agenda_groups" ("id")
          ON DELETE SET NULL,
        "coach_membership_id" uuid REFERENCES "memberships" ("id")
          ON DELETE SET NULL,
        "position" integer NOT NULL,
        "name" text NOT NULL,
        "repetitions" integer,
        "target" text,
        "notes" text,
        "completion_status" text NOT NULL DEFAULT 'planned',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "version" integer NOT NULL DEFAULT 1,
        CONSTRAINT "ck_station_completion" CHECK ("completion_status" IN
          ('planned', 'completed', 'skipped')),
        CONSTRAINT "ck_station_position" CHECK ("position" >= 0),
        CONSTRAINT "ck_station_repetitions" CHECK ("repetitions" IS NULL OR
          "repetitions" > 0)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_agenda_stations_block_position"
         ON "practice_agenda_stations" ("block_id", "position")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_agenda_stations_agenda"
         ON "practice_agenda_stations" ("agenda_id")`,
    );
  }
}
