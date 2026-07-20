import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Competition rosters, match rosters, availability, locks, and snapshots
 * (UN-502). Four additive tables plus one deferred foreign key — it changes no
 * existing table and grants no new permission (roster.read / roster.manage /
 * roster.lock are already seeded and bundled by the RBAC baseline):
 *
 *   - rosters            one model for a competition roster (drawn from the
 *                        season squad) and a per-fixture match roster, moving
 *                        draft → published → locked → revised → archived. A
 *                        revision never edits history: the superseded roster
 *                        stays in `revised` (with its mandatory reason) and the
 *                        successor is a new row pointing back through
 *                        `supersedes_roster_id`. Carries the server-validated
 *                        composition constraints (min/max size, minimum women —
 *                        NULL means "not applicable", never zero — captain
 *                        requirement, division).
 *   - roster_entries     one entry per member per roster with jersey, role
 *                        (player / captain / spirit captain / coach), line,
 *                        field position, gender bucket, the availability known
 *                        at selection, the selection reason, and the explicit
 *                        override evidence when a flagged player was rostered.
 *                        Removal is a soft `withdrawn` status so match history
 *                        is never deleted.
 *   - roster_availability a member's own going / not-going declaration for a
 *                        roster; one declaration per member, upserted.
 *   - roster_snapshots   the immutable point-in-time record taken when a roster
 *                        is published, locked, or superseded by a revision. Rows
 *                        are append-only: an ON UPDATE DO INSTEAD NOTHING rule
 *                        makes rewriting a snapshot a no-op at the database
 *                        level, so a later squad or roster edit can never alter
 *                        recorded history. The frozen entry payload is
 *                        privacy-safe (ids and classifications only, no names).
 *
 * Conventions: UUID PKs via gen_random_uuid(), timestamptz UTC, snake_case,
 * check constraints mirroring the enums, optimistic record_version, partial
 * unique indexes for the live roster per competition/fixture, jersey uniqueness,
 * and the single captain / spirit captain. Fully reversible: down drops the
 * circular snapshot foreign key then the tables in dependency order. Proven from
 * empty by the integration + e2e suites.
 */
export class RostersSchema1723500000000 implements MigrationInterface {
  name = 'RostersSchema1723500000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await this.createRosters(queryRunner);
    await this.createEntries(queryRunner);
    await this.createAvailability(queryRunner);
    await this.createSnapshots(queryRunner);
    await this.linkCurrentSnapshot(queryRunner);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "rosters" DROP CONSTRAINT IF EXISTS
         "fk_rosters_current_snapshot"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "roster_snapshots"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "roster_availability"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "roster_entries"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "rosters"`);
  }

  private async createRosters(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "rosters" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "team_id" uuid NOT NULL REFERENCES "teams" ("id") ON DELETE CASCADE,
        "season_id" uuid NOT NULL REFERENCES "seasons" ("id") ON DELETE CASCADE,
        "competition_id" uuid NOT NULL REFERENCES "competitions" ("id")
          ON DELETE CASCADE,
        "fixture_id" uuid REFERENCES "fixtures" ("id") ON DELETE CASCADE,
        "squad_id" uuid REFERENCES "squads" ("id") ON DELETE SET NULL,
        "source_roster_id" uuid REFERENCES "rosters" ("id") ON DELETE SET NULL,
        "supersedes_roster_id" uuid REFERENCES "rosters" ("id")
          ON DELETE SET NULL,
        "current_snapshot_id" uuid,
        "roster_kind" text NOT NULL,
        "name" text NOT NULL,
        "status" text NOT NULL DEFAULT 'draft',
        "division" text NOT NULL DEFAULT 'unspecified',
        "min_size" integer NOT NULL DEFAULT 7,
        "max_size" integer NOT NULL DEFAULT 30,
        "min_women" integer,
        "require_captain" boolean NOT NULL DEFAULT true,
        "policy_version" text NOT NULL DEFAULT 'roster-constraints-v1',
        "selection_deadline" timestamptz,
        "notes" text,
        "revision" integer NOT NULL DEFAULT 1,
        "record_version" integer NOT NULL DEFAULT 1,
        "created_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "published_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "published_at" timestamptz,
        "locked_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "locked_at" timestamptz,
        "revised_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "revised_at" timestamptz,
        "revision_reason" text,
        "archived_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "ck_roster_kind" CHECK ("roster_kind" IN
          ('competition', 'match')),
        CONSTRAINT "ck_roster_status" CHECK ("status" IN
          ('draft', 'published', 'locked', 'revised', 'archived')),
        CONSTRAINT "ck_roster_division" CHECK ("division" IN
          ('open', 'women', 'mixed', 'unspecified')),
        CONSTRAINT "ck_roster_fixture" CHECK
          (("roster_kind" = 'match') = ("fixture_id" IS NOT NULL)),
        CONSTRAINT "ck_roster_size" CHECK
          ("min_size" > 0 AND "max_size" >= "min_size"),
        CONSTRAINT "ck_roster_min_women" CHECK
          ("min_women" IS NULL OR "min_women" >= 0),
        CONSTRAINT "ck_roster_revision" CHECK ("revision" > 0),
        CONSTRAINT "ck_roster_version" CHECK ("record_version" > 0),
        CONSTRAINT "ck_roster_revision_reason" CHECK
          ("status" <> 'revised' OR "revision_reason" IS NOT NULL)
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_rosters_competition_live"
         ON "rosters" ("competition_id")
        WHERE "roster_kind" = 'competition'
          AND "status" IN ('draft', 'published', 'locked')`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_rosters_fixture_live"
         ON "rosters" ("fixture_id")
        WHERE "roster_kind" = 'match'
          AND "status" IN ('draft', 'published', 'locked')`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_rosters_team_scope"
         ON "rosters" ("team_id", "season_id", "status", "created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_rosters_competition_revision"
         ON "rosters" ("competition_id", "roster_kind", "revision")`,
    );
  }

  private async createEntries(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "roster_entries" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "roster_id" uuid NOT NULL REFERENCES "rosters" ("id") ON DELETE CASCADE,
        "team_id" uuid NOT NULL REFERENCES "teams" ("id") ON DELETE CASCADE,
        "membership_id" uuid NOT NULL REFERENCES "memberships" ("id")
          ON DELETE CASCADE,
        "jersey_number" integer,
        "entry_role" text NOT NULL DEFAULT 'player',
        "line_assignment" text NOT NULL DEFAULT 'any',
        "field_position" text NOT NULL DEFAULT 'unspecified',
        "gender_bucket" text NOT NULL DEFAULT 'unknown',
        "status" text NOT NULL DEFAULT 'selected',
        "availability" text,
        "selection_reason" text,
        "constraint_overridden" boolean NOT NULL DEFAULT false,
        "override_reason" text,
        "overridden_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "selected_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "removed_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "removed_at" timestamptz,
        "removal_reason" text,
        "record_version" integer NOT NULL DEFAULT 1,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "ck_entry_role" CHECK ("entry_role" IN
          ('player', 'captain', 'spirit_captain', 'coach')),
        CONSTRAINT "ck_entry_line" CHECK ("line_assignment" IN
          ('offense', 'defense', 'any')),
        CONSTRAINT "ck_entry_position" CHECK ("field_position" IN
          ('handler', 'cutter', 'hybrid', 'unspecified')),
        CONSTRAINT "ck_entry_gender" CHECK ("gender_bucket" IN
          ('men', 'women', 'mixed', 'unknown')),
        CONSTRAINT "ck_entry_status" CHECK ("status" IN
          ('selected', 'withdrawn')),
        CONSTRAINT "ck_entry_availability" CHECK ("availability" IS NULL OR
          "availability" IN ('available', 'unavailable', 'tentative')),
        CONSTRAINT "ck_entry_jersey" CHECK ("jersey_number" IS NULL OR
          ("jersey_number" >= 0 AND "jersey_number" <= 999)),
        CONSTRAINT "ck_entry_override" CHECK
          (NOT "constraint_overridden" OR "override_reason" IS NOT NULL),
        CONSTRAINT "ck_entry_version" CHECK ("record_version" > 0)
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_entries_roster_member"
         ON "roster_entries" ("roster_id", "membership_id")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_entries_roster_jersey"
         ON "roster_entries" ("roster_id", "jersey_number")
        WHERE "jersey_number" IS NOT NULL AND "status" = 'selected'`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_entries_roster_captain"
         ON "roster_entries" ("roster_id")
        WHERE "entry_role" = 'captain' AND "status" = 'selected'`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_entries_roster_spirit_captain"
         ON "roster_entries" ("roster_id")
        WHERE "entry_role" = 'spirit_captain' AND "status" = 'selected'`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_entries_roster_status"
         ON "roster_entries" ("roster_id", "status", "jersey_number")`,
    );
  }

  private async createAvailability(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "roster_availability" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "roster_id" uuid NOT NULL REFERENCES "rosters" ("id") ON DELETE CASCADE,
        "team_id" uuid NOT NULL REFERENCES "teams" ("id") ON DELETE CASCADE,
        "membership_id" uuid NOT NULL REFERENCES "memberships" ("id")
          ON DELETE CASCADE,
        "availability" text NOT NULL,
        "reason" text,
        "source" text NOT NULL DEFAULT 'self',
        "declared_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "record_version" integer NOT NULL DEFAULT 1,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "ck_roster_availability_status" CHECK ("availability" IN
          ('available', 'unavailable', 'tentative')),
        CONSTRAINT "ck_roster_availability_source" CHECK ("source" IN
          ('self', 'coach')),
        CONSTRAINT "ck_roster_availability_version" CHECK
          ("record_version" > 0)
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_roster_availability_member"
         ON "roster_availability" ("roster_id", "membership_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_roster_availability_status"
         ON "roster_availability" ("roster_id", "availability")`,
    );
  }

  private async createSnapshots(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "roster_snapshots" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "roster_id" uuid NOT NULL REFERENCES "rosters" ("id") ON DELETE CASCADE,
        "team_id" uuid NOT NULL REFERENCES "teams" ("id") ON DELETE CASCADE,
        "season_id" uuid NOT NULL REFERENCES "seasons" ("id") ON DELETE CASCADE,
        "competition_id" uuid NOT NULL REFERENCES "competitions" ("id")
          ON DELETE CASCADE,
        "fixture_id" uuid REFERENCES "fixtures" ("id") ON DELETE SET NULL,
        "roster_kind" text NOT NULL,
        "revision" integer NOT NULL,
        "reason" text NOT NULL,
        "roster_status" text NOT NULL,
        "entry_count" integer NOT NULL,
        "checksum" text NOT NULL,
        "entries" jsonb NOT NULL,
        "taken_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "taken_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "ck_snapshot_kind" CHECK ("roster_kind" IN
          ('competition', 'match')),
        CONSTRAINT "ck_snapshot_reason" CHECK ("reason" IN
          ('published', 'locked', 'revised')),
        CONSTRAINT "ck_snapshot_revision" CHECK ("revision" > 0),
        CONSTRAINT "ck_snapshot_entry_count" CHECK ("entry_count" >= 0)
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_snapshots_roster_revision_reason"
         ON "roster_snapshots" ("roster_id", "revision", "reason")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_snapshots_competition"
         ON "roster_snapshots" ("competition_id", "taken_at", "id")`,
    );
    await queryRunner.query(
      `CREATE RULE "rl_roster_snapshots_immutable" AS
         ON UPDATE TO "roster_snapshots" DO INSTEAD NOTHING`,
    );
  }

  private async linkCurrentSnapshot(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "rosters" ADD CONSTRAINT "fk_rosters_current_snapshot"
         FOREIGN KEY ("current_snapshot_id") REFERENCES "roster_snapshots" ("id")
         ON DELETE SET NULL`,
    );
  }
}
