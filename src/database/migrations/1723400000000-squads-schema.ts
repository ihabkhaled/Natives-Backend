import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Season squads, eligibility signals, availability, and selection (UN-501). Four
 * additive tables — it changes no existing table and grants no new permission
 * (squad.read / squad.manage / squad.override_eligibility are already seeded and
 * bundled by the RBAC baseline):
 *
 *   - squads                  the eligible player pool for a team + season and
 *                             optional competition, moving draft → published →
 *                             locked → archived (revise returns a published/locked
 *                             squad to draft and bumps its revision so history is
 *                             kept). Carries the configurable attendance threshold
 *                             (legacy 70% CANDIDATE default — advisory only) and
 *                             the named eligibility policy version.
 *   - squad_selections        one selection per member per squad (kept for history
 *                             via a `removed` status). Records the selector, role,
 *                             reason, and the eligibility snapshot; an override
 *                             stamps the override reason + actor as immutable
 *                             evidence that a permitted human accepted a flag.
 *   - squad_selection_events  append-only selection history (selected / removed /
 *                             role_changed / overridden). Never updated.
 *   - squad_availability      a member's self-declared availability for the squad's
 *                             competition/period; one declaration per member.
 *
 * Conventions: UUID PKs via gen_random_uuid(), timestamptz UTC, snake_case, check
 * constraints mirroring the enums, optimistic record_version, soft-delete +
 * partial-unique indexes, and an override-consistency check (an overridden
 * selection must carry an override reason). Signals are advisory: no column
 * automatically excludes a player. Fully reversible: down drops the tables in
 * dependency order. Proven from empty by the integration + e2e suites.
 */
export class SquadsSchema1723400000000 implements MigrationInterface {
  name = 'SquadsSchema1723400000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await this.createSquads(queryRunner);
    await this.createSelections(queryRunner);
    await this.createSelectionEvents(queryRunner);
    await this.createAvailability(queryRunner);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "squad_selection_events"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "squad_availability"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "squad_selections"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "squads"`);
  }

  private async createSquads(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "squads" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "team_id" uuid NOT NULL REFERENCES "teams" ("id") ON DELETE CASCADE,
        "season_id" uuid NOT NULL REFERENCES "seasons" ("id") ON DELETE CASCADE,
        "competition_id" uuid REFERENCES "competitions" ("id")
          ON DELETE SET NULL,
        "name" text NOT NULL,
        "status" text NOT NULL DEFAULT 'draft',
        "attendance_threshold_pct" numeric(5, 2) NOT NULL DEFAULT 70,
        "policy_version" text NOT NULL DEFAULT 'eligibility-signals-v1',
        "selection_deadline" timestamptz,
        "notes" text,
        "revision" integer NOT NULL DEFAULT 1,
        "record_version" integer NOT NULL DEFAULT 1,
        "created_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "published_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "published_at" timestamptz,
        "locked_at" timestamptz,
        "archived_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,
        CONSTRAINT "ck_squad_status" CHECK ("status" IN
          ('draft', 'published', 'locked', 'archived')),
        CONSTRAINT "ck_squad_threshold" CHECK
          ("attendance_threshold_pct" >= 0 AND "attendance_threshold_pct" <= 100),
        CONSTRAINT "ck_squad_revision" CHECK ("revision" > 0),
        CONSTRAINT "ck_squad_version" CHECK ("record_version" > 0)
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_squads_scope_name"
         ON "squads" ("team_id", "season_id",
           COALESCE("competition_id",
             '00000000-0000-0000-0000-000000000000'::uuid), lower("name"))
        WHERE "deleted_at" IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_squads_scope_status"
         ON "squads" ("team_id", "season_id", "status", "created_at")`,
    );
  }

  private async createSelections(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "squad_selections" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "squad_id" uuid NOT NULL REFERENCES "squads" ("id") ON DELETE CASCADE,
        "team_id" uuid NOT NULL REFERENCES "teams" ("id") ON DELETE CASCADE,
        "membership_id" uuid NOT NULL REFERENCES "memberships" ("id")
          ON DELETE CASCADE,
        "selection_role" text NOT NULL DEFAULT 'player',
        "status" text NOT NULL DEFAULT 'selected',
        "reason" text,
        "eligibility_overridden" boolean NOT NULL DEFAULT false,
        "override_reason" text,
        "overridden_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "eligibility_snapshot" text NOT NULL,
        "selected_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "removed_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "removed_at" timestamptz,
        "record_version" integer NOT NULL DEFAULT 1,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "ck_selection_role" CHECK ("selection_role" IN
          ('player', 'captain', 'vice_captain')),
        CONSTRAINT "ck_selection_status" CHECK ("status" IN
          ('selected', 'removed')),
        CONSTRAINT "ck_selection_version" CHECK ("record_version" > 0),
        CONSTRAINT "ck_selection_override" CHECK
          (NOT "eligibility_overridden" OR "override_reason" IS NOT NULL)
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_selections_squad_member"
         ON "squad_selections" ("squad_id", "membership_id")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_selections_squad_captain"
         ON "squad_selections" ("squad_id")
        WHERE "selection_role" = 'captain' AND "status" = 'selected'`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_selections_squad_status"
         ON "squad_selections" ("squad_id", "status")`,
    );
  }

  private async createSelectionEvents(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "squad_selection_events" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "squad_id" uuid NOT NULL REFERENCES "squads" ("id") ON DELETE CASCADE,
        "membership_id" uuid NOT NULL REFERENCES "memberships" ("id")
          ON DELETE CASCADE,
        "event_type" text NOT NULL,
        "selection_role" text,
        "reason" text,
        "eligibility_snapshot" text NOT NULL,
        "actor_user_id" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "occurred_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "ck_selection_event_type" CHECK ("event_type" IN
          ('selected', 'removed', 'role_changed', 'overridden'))
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_selection_events_squad_member"
         ON "squad_selection_events" ("squad_id", "membership_id",
           "occurred_at")`,
    );
  }

  private async createAvailability(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "squad_availability" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "squad_id" uuid NOT NULL REFERENCES "squads" ("id") ON DELETE CASCADE,
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
        CONSTRAINT "ck_availability_status" CHECK ("availability" IN
          ('available', 'unavailable', 'tentative')),
        CONSTRAINT "ck_availability_source" CHECK ("source" IN
          ('self', 'coach')),
        CONSTRAINT "ck_availability_version" CHECK ("record_version" > 0)
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_availability_squad_member"
         ON "squad_availability" ("squad_id", "membership_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_availability_squad_status"
         ON "squad_availability" ("squad_id", "availability")`,
    );
  }
}
