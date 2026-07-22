import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Standings, results, achievements, and team history (UN-506). Three additive
 * tables; it changes no existing table and grants no new permission
 * (competition.read / competition.manage / import.manage are already seeded):
 *
 *   - standings_rule_versions  the NAMED, versioned rule a standings table was
 *                              computed under: points per win/loss/tie and the
 *                              ordered tie-break codes. A stored standing cites
 *                              the exact version it was produced by, so a later
 *                              rule change never silently re-orders history.
 *   - competition_standings    one row per entrant per competition (optionally
 *                              per stage/pool): played, wins, losses, ties,
 *                              points for/against, the spirit score WHEN it is
 *                              known (NULL means not scored — never zero), the
 *                              computed standing points, the final place and the
 *                              qualification outcome, plus the provenance of the
 *                              row (derived from finalized matches, entered
 *                              manually, or imported) and the reconciliation
 *                              note a manual override must carry.
 *   - team_achievements        team and player achievements with category,
 *                              season/competition, date, description, an
 *                              evidence reference, an explicit visibility class
 *                              and a human approval step. Historical imports
 *                              carry their audited source reference so a
 *                              re-import can never duplicate the trophy cabinet.
 *
 * Conventions: UUID PKs via gen_random_uuid(), timestamptz UTC, snake_case,
 * check constraints mirroring the enums, optimistic record_version, and bounded
 * deterministic indexes. Fully reversible.
 */
export class StandingsSchema1724000000000 implements MigrationInterface {
  name = 'StandingsSchema1724000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await this.createRuleVersions(queryRunner);
    await this.createStandings(queryRunner);
    await this.createAchievements(queryRunner);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "team_achievements"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "competition_standings"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "standings_rule_versions"`);
  }

  private async createRuleVersions(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "standings_rule_versions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "team_id" uuid NOT NULL REFERENCES "teams" ("id") ON DELETE CASCADE,
        "rule_key" text NOT NULL,
        "version" integer NOT NULL,
        "name" text NOT NULL,
        "win_points" integer NOT NULL DEFAULT 3,
        "loss_points" integer NOT NULL DEFAULT 0,
        "tie_points" integer NOT NULL DEFAULT 1,
        "tie_break_order" text[] NOT NULL,
        "effective_from" timestamptz NOT NULL,
        "status" text NOT NULL DEFAULT 'active',
        "created_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "ck_standings_rule_status" CHECK ("status" IN
          ('active', 'archived')),
        CONSTRAINT "ck_standings_rule_version" CHECK ("version" > 0)
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_standings_rule_key_version"
         ON "standings_rule_versions" ("team_id", "rule_key", "version")`,
    );
    await queryRunner.query(
      `CREATE RULE "rl_standings_rule_versions_immutable" AS
         ON UPDATE TO "standings_rule_versions" DO INSTEAD NOTHING`,
    );
  }

  private async createStandings(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "competition_standings" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "team_id" uuid NOT NULL REFERENCES "teams" ("id") ON DELETE CASCADE,
        "season_id" uuid NOT NULL REFERENCES "seasons" ("id") ON DELETE CASCADE,
        "competition_id" uuid NOT NULL REFERENCES "competitions" ("id")
          ON DELETE CASCADE,
        "stage_id" uuid REFERENCES "competition_stages" ("id")
          ON DELETE SET NULL,
        "rule_version_id" uuid NOT NULL
          REFERENCES "standings_rule_versions" ("id") ON DELETE RESTRICT,
        "pool_label" text,
        "entrant_kind" text NOT NULL,
        "opponent_id" uuid REFERENCES "opponents" ("id") ON DELETE CASCADE,
        "played" integer NOT NULL DEFAULT 0,
        "wins" integer NOT NULL DEFAULT 0,
        "losses" integer NOT NULL DEFAULT 0,
        "ties" integer NOT NULL DEFAULT 0,
        "points_for" integer NOT NULL DEFAULT 0,
        "points_against" integer NOT NULL DEFAULT 0,
        "standing_points" integer NOT NULL DEFAULT 0,
        "spirit_score" numeric(4, 2),
        "final_place" integer,
        "qualification" text NOT NULL DEFAULT 'undecided',
        "source" text NOT NULL DEFAULT 'derived',
        "source_reference" text,
        "reconciliation_note" text,
        "record_version" integer NOT NULL DEFAULT 1,
        "recorded_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "computed_at" timestamptz NOT NULL DEFAULT now(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "ck_standing_entrant" CHECK ("entrant_kind" IN
          ('team', 'opponent')),
        CONSTRAINT "ck_standing_qualification" CHECK ("qualification" IN
          ('undecided', 'qualified', 'eliminated', 'promoted', 'relegated')),
        CONSTRAINT "ck_standing_source" CHECK ("source" IN
          ('derived', 'manual', 'import')),
        CONSTRAINT "ck_standing_counts" CHECK
          ("played" >= 0 AND "wins" >= 0 AND "losses" >= 0 AND "ties" >= 0),
        CONSTRAINT "ck_standing_points" CHECK
          ("points_for" >= 0 AND "points_against" >= 0),
        CONSTRAINT "ck_standing_place" CHECK
          ("final_place" IS NULL OR "final_place" > 0),
        CONSTRAINT "ck_standing_spirit" CHECK
          ("spirit_score" IS NULL OR ("spirit_score" >= 0
            AND "spirit_score" <= 20)),
        CONSTRAINT "ck_standing_entrant_identity" CHECK
          (("entrant_kind" = 'team' AND "opponent_id" IS NULL)
            OR ("entrant_kind" = 'opponent' AND "opponent_id" IS NOT NULL)),
        CONSTRAINT "ck_standing_manual_note" CHECK
          ("source" = 'derived' OR "reconciliation_note" IS NOT NULL)
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_standings_entrant"
         ON "competition_standings" ("competition_id",
           COALESCE("stage_id", '00000000-0000-0000-0000-000000000000'::uuid),
           "entrant_kind",
           COALESCE("opponent_id", '00000000-0000-0000-0000-000000000000'::uuid))`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_standings_scope"
         ON "competition_standings" ("team_id", "season_id",
           "competition_id", "id")`,
    );
  }

  private async createAchievements(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "team_achievements" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "team_id" uuid NOT NULL REFERENCES "teams" ("id") ON DELETE CASCADE,
        "season_id" uuid REFERENCES "seasons" ("id") ON DELETE SET NULL,
        "competition_id" uuid REFERENCES "competitions" ("id")
          ON DELETE SET NULL,
        "membership_id" uuid REFERENCES "memberships" ("id") ON DELETE SET NULL,
        "category" text NOT NULL,
        "title" text NOT NULL,
        "description" text,
        "achieved_on" date NOT NULL,
        "evidence_reference" text,
        "visibility" text NOT NULL DEFAULT 'team',
        "status" text NOT NULL DEFAULT 'draft',
        "source" text NOT NULL DEFAULT 'manual',
        "import_reference" text,
        "record_version" integer NOT NULL DEFAULT 1,
        "created_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "approved_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "approved_at" timestamptz,
        "rejected_at" timestamptz,
        "archived_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "ck_achievement_category" CHECK ("category" IN
          ('trophy', 'placement', 'award', 'milestone', 'spirit',
           'participation')),
        CONSTRAINT "ck_achievement_visibility" CHECK ("visibility" IN
          ('public', 'team', 'staff')),
        CONSTRAINT "ck_achievement_status" CHECK ("status" IN
          ('draft', 'submitted', 'approved', 'rejected', 'archived')),
        CONSTRAINT "ck_achievement_source" CHECK ("source" IN
          ('manual', 'derived', 'import'))
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_achievements_import_reference"
         ON "team_achievements" ("team_id", "import_reference")
         WHERE "import_reference" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_achievements_cabinet"
         ON "team_achievements" ("team_id", "status", "achieved_on" DESC, "id")`,
    );
  }
}
