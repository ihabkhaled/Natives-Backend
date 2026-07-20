import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Competitions, stages, opponents, and fixtures (UN-500). Five additive tables
 * plus one idempotent RBAC grant — it changes no existing table:
 *
 *   - opponents           the catalogue of external teams a team plays (name,
 *                         logo reference, minimal contact). Team-scoped, soft
 *                         deletable, with a partial-unique name per team.
 *   - competitions        one model for leagues, championships, tournaments,
 *                         friendlies, and custom events, per team + season, moving
 *                         draft → published → active → completed / cancelled →
 *                         archived. Cancellation stamps a reason and keeps every
 *                         historical stage/round/fixture (nothing is deleted).
 *   - competition_stages  ordered stages (group/pool/bracket/knockout/round_robin)
 *                         of a competition, unique per (competition, ordinal).
 *   - competition_rounds  ordered rounds within a stage, unique per (stage,
 *                         ordinal); denormalises competition_id for fixture scope.
 *   - fixtures            scheduled matches versus a catalogued opponent with a
 *                         venue, a UTC instant (presented in Africa/Cairo), a
 *                         home/away/neutral side, and optional stage/round linkage,
 *                         moving scheduled → rescheduled → ready → live → final /
 *                         abandoned / cancelled. Match play and scoring are later
 *                         prompts — this is the schedule shell.
 *
 * Conventions: UUID PKs via gen_random_uuid(), timestamptz UTC, snake_case, check
 * constraints mirroring the enums, optimistic record_version, soft-delete +
 * partial-unique indexes, bounded covering indexes for the team calendar. The
 * `competition.manage` permission is granted to the coach and team_admin bundles
 * idempotently (expand pattern; the RBAC baseline did not include it). Fully
 * reversible: down revokes the grant then drops the tables in dependency order.
 * Proven from empty by the integration + e2e suites.
 */

const MANAGE_ROLES: readonly string[] = ['COACH', 'TEAM_ADMIN'];
const COMPETITION_MANAGE = 'competition.manage';

export class CompetitionsSchema1723300000000 implements MigrationInterface {
  name = 'CompetitionsSchema1723300000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await this.createOpponents(queryRunner);
    await this.createCompetitions(queryRunner);
    await this.createStages(queryRunner);
    await this.createRounds(queryRunner);
    await this.createFixtures(queryRunner);
    await this.grantManage(queryRunner);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await this.revokeManage(queryRunner);
    await queryRunner.query(`DROP TABLE IF EXISTS "fixtures"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "competition_rounds"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "competition_stages"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "competitions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "opponents"`);
  }

  private async createOpponents(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "opponents" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "team_id" uuid NOT NULL REFERENCES "teams" ("id") ON DELETE CASCADE,
        "name" text NOT NULL,
        "short_name" text,
        "logo_ref" text,
        "contact_name" text,
        "contact_info" text,
        "notes" text,
        "status" text NOT NULL DEFAULT 'active',
        "record_version" integer NOT NULL DEFAULT 1,
        "created_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,
        CONSTRAINT "ck_opponent_status"
          CHECK ("status" IN ('active', 'archived')),
        CONSTRAINT "ck_opponent_version" CHECK ("record_version" > 0)
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_opponents_team_name"
         ON "opponents" ("team_id", lower("name"))
        WHERE "deleted_at" IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_opponents_team_status"
         ON "opponents" ("team_id", "status", "name")`,
    );
  }

  private async createCompetitions(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "competitions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "team_id" uuid NOT NULL REFERENCES "teams" ("id") ON DELETE CASCADE,
        "season_id" uuid NOT NULL REFERENCES "seasons" ("id") ON DELETE CASCADE,
        "name" text NOT NULL,
        "competition_type" text NOT NULL,
        "status" text NOT NULL DEFAULT 'draft',
        "gender_division" text,
        "organizer_name" text,
        "external_ref" text,
        "starts_on" date,
        "ends_on" date,
        "description" text,
        "cancellation_reason" text,
        "record_version" integer NOT NULL DEFAULT 1,
        "created_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "published_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "published_at" timestamptz,
        "activated_at" timestamptz,
        "completed_at" timestamptz,
        "cancelled_at" timestamptz,
        "archived_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,
        CONSTRAINT "ck_competition_type" CHECK ("competition_type" IN
          ('league', 'championship', 'tournament', 'friendly', 'custom')),
        CONSTRAINT "ck_competition_status" CHECK ("status" IN
          ('draft', 'published', 'active', 'completed', 'cancelled',
           'archived')),
        CONSTRAINT "ck_competition_version" CHECK ("record_version" > 0),
        CONSTRAINT "ck_competition_dates"
          CHECK ("starts_on" IS NULL OR "ends_on" IS NULL
                 OR "starts_on" <= "ends_on")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_competitions_team_season_name"
         ON "competitions" ("team_id", "season_id", lower("name"))
        WHERE "deleted_at" IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_competitions_scope_status"
         ON "competitions" ("team_id", "season_id", "status", "created_at")`,
    );
  }

  private async createStages(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "competition_stages" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "competition_id" uuid NOT NULL REFERENCES "competitions" ("id")
          ON DELETE CASCADE,
        "name" text NOT NULL,
        "stage_format" text NOT NULL DEFAULT 'group',
        "ordinal" integer NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "ck_stage_format" CHECK ("stage_format" IN
          ('group', 'pool', 'bracket', 'knockout', 'round_robin')),
        CONSTRAINT "ck_stage_ordinal" CHECK ("ordinal" > 0)
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_stages_competition_ordinal"
         ON "competition_stages" ("competition_id", "ordinal")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_stages_competition_name"
         ON "competition_stages" ("competition_id", lower("name"))`,
    );
  }

  private async createRounds(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "competition_rounds" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "stage_id" uuid NOT NULL REFERENCES "competition_stages" ("id")
          ON DELETE CASCADE,
        "competition_id" uuid NOT NULL REFERENCES "competitions" ("id")
          ON DELETE CASCADE,
        "name" text NOT NULL,
        "ordinal" integer NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "ck_round_ordinal" CHECK ("ordinal" > 0)
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_rounds_stage_ordinal"
         ON "competition_rounds" ("stage_id", "ordinal")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_rounds_competition"
         ON "competition_rounds" ("competition_id", "stage_id", "ordinal")`,
    );
  }

  private async createFixtures(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "fixtures" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "competition_id" uuid NOT NULL REFERENCES "competitions" ("id")
          ON DELETE CASCADE,
        "team_id" uuid NOT NULL REFERENCES "teams" ("id") ON DELETE CASCADE,
        "season_id" uuid REFERENCES "seasons" ("id") ON DELETE SET NULL,
        "stage_id" uuid REFERENCES "competition_stages" ("id")
          ON DELETE SET NULL,
        "round_id" uuid REFERENCES "competition_rounds" ("id")
          ON DELETE SET NULL,
        "opponent_id" uuid NOT NULL REFERENCES "opponents" ("id")
          ON DELETE RESTRICT,
        "venue_id" uuid REFERENCES "venues" ("id") ON DELETE SET NULL,
        "home_away" text NOT NULL,
        "scheduled_at" timestamptz NOT NULL,
        "status" text NOT NULL DEFAULT 'scheduled',
        "reschedule_count" integer NOT NULL DEFAULT 0,
        "previous_scheduled_at" timestamptz,
        "reschedule_reason" text,
        "cancellation_reason" text,
        "record_version" integer NOT NULL DEFAULT 1,
        "created_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "rescheduled_at" timestamptz,
        "finalized_at" timestamptz,
        "cancelled_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,
        CONSTRAINT "ck_fixture_home_away"
          CHECK ("home_away" IN ('home', 'away', 'neutral')),
        CONSTRAINT "ck_fixture_status" CHECK ("status" IN
          ('scheduled', 'rescheduled', 'ready', 'live', 'final', 'abandoned',
           'cancelled')),
        CONSTRAINT "ck_fixture_version" CHECK ("record_version" > 0),
        CONSTRAINT "ck_fixture_reschedule_count"
          CHECK ("reschedule_count" >= 0)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_fixtures_team_calendar"
         ON "fixtures" ("team_id", "scheduled_at", "id")
        WHERE "deleted_at" IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_fixtures_competition"
         ON "fixtures" ("competition_id", "scheduled_at", "id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_fixtures_opponent"
         ON "fixtures" ("opponent_id")`,
    );
  }

  private async grantManage(queryRunner: QueryRunner): Promise<void> {
    for (const roleKey of MANAGE_ROLES) {
      await queryRunner.query(
        `INSERT INTO "role_permissions" ("role_id", "permission_id")
         SELECT r."id", p."id" FROM "roles" r, "permissions" p
          WHERE r."key" = $1 AND p."key" = $2
         ON CONFLICT DO NOTHING`,
        [roleKey, COMPETITION_MANAGE],
      );
    }
  }

  private async revokeManage(queryRunner: QueryRunner): Promise<void> {
    for (const roleKey of MANAGE_ROLES) {
      await queryRunner.query(
        `DELETE FROM "role_permissions" rp
          USING "roles" r, "permissions" p
          WHERE rp."role_id" = r."id" AND rp."permission_id" = p."id"
            AND r."key" = $1 AND p."key" = $2`,
        [roleKey, COMPETITION_MANAGE],
      );
    }
  }
}
