import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Versioned performance score engine (UN-303). Two additive tables:
 *
 *   - calculation_rules   named, versioned calculation-rule definitions moving
 *                         draft → approved → published → retired. Weighted
 *                         category components live in a jsonb array; the numeric
 *                         scale, minimum-components floor, and optional effective
 *                         window are constrained. A partial unique index allows at
 *                         most one PUBLISHED rule per (team scope, rule key). The
 *                         legacy equal-weight overall is seeded as a DRAFT
 *                         candidate (team_id NULL) — never activated automatically.
 *   - performance_score_projections  rebuildable score caches keyed uniquely by
 *                         (membership, rule). A projection is never a hand-edited
 *                         total: overall value/numerator/denominator are stored
 *                         alongside the full explanation jsonb, missing values as
 *                         NULL (never zero), and a stale/building/ready/failed
 *                         status drives asynchronous rebuilds.
 *
 * Conventions: UUID PKs via gen_random_uuid(), timestamptz UTC, snake_case, check
 * constraints mirroring the enums, bounded covering indexes. Fully reversible: the
 * down drops exactly what the up created, in dependency order. Changes no existing
 * table.
 */
export class ScoringSchema1722700000000 implements MigrationInterface {
  name = 'ScoringSchema1722700000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await this.createRules(queryRunner);
    await this.createProjections(queryRunner);
    await this.seedLegacyCandidate(queryRunner);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TABLE IF EXISTS "performance_score_projections"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "calculation_rules"`);
  }

  private async createRules(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "calculation_rules" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "team_id" uuid REFERENCES "teams" ("id") ON DELETE CASCADE,
        "season_id" uuid REFERENCES "seasons" ("id") ON DELETE SET NULL,
        "rule_key" text NOT NULL,
        "version" integer NOT NULL,
        "name" text NOT NULL,
        "description" text,
        "status" text NOT NULL DEFAULT 'draft',
        "scale_min" numeric NOT NULL DEFAULT 0,
        "scale_max" numeric NOT NULL DEFAULT 5,
        "min_components" integer NOT NULL DEFAULT 1,
        "components" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "effective_from" date,
        "effective_to" date,
        "record_version" integer NOT NULL DEFAULT 1,
        "created_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "published_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "published_at" timestamptz,
        "retired_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "ck_calculation_rule_status" CHECK ("status" IN
          ('draft', 'approved', 'published', 'retired')),
        CONSTRAINT "ck_calculation_rule_versions"
          CHECK ("version" > 0 AND "record_version" > 0),
        CONSTRAINT "ck_calculation_rule_scale" CHECK ("scale_min" < "scale_max"),
        CONSTRAINT "ck_calculation_rule_min_components"
          CHECK ("min_components" >= 1),
        CONSTRAINT "ck_calculation_rule_components"
          CHECK (jsonb_typeof("components") = 'array'),
        CONSTRAINT "ck_calculation_rule_effective"
          CHECK ("effective_from" IS NULL OR "effective_to" IS NULL
                 OR "effective_from" <= "effective_to")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_calculation_rule_scope_version"
         ON "calculation_rules"
          (COALESCE("team_id", '00000000-0000-0000-0000-000000000000'::uuid),
           "rule_key", "version")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_calculation_rule_published"
         ON "calculation_rules"
          (COALESCE("team_id", '00000000-0000-0000-0000-000000000000'::uuid),
           "rule_key")
        WHERE "status" = 'published'`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_calculation_rules_scope_list"
         ON "calculation_rules"
          ("team_id", "rule_key", "version" DESC, "id")`,
    );
  }

  private async createProjections(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "performance_score_projections" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "team_id" uuid NOT NULL REFERENCES "teams" ("id") ON DELETE CASCADE,
        "season_id" uuid REFERENCES "seasons" ("id") ON DELETE SET NULL,
        "membership_id" uuid NOT NULL REFERENCES "memberships" ("id")
          ON DELETE CASCADE,
        "period_id" uuid REFERENCES "assessment_periods" ("id")
          ON DELETE SET NULL,
        "rule_id" uuid NOT NULL REFERENCES "calculation_rules" ("id")
          ON DELETE CASCADE,
        "rule_key" text NOT NULL,
        "rule_version" integer NOT NULL,
        "status" text NOT NULL DEFAULT 'stale',
        "overall_value" numeric,
        "overall_numerator" numeric,
        "overall_denominator" numeric,
        "included_count" integer NOT NULL DEFAULT 0,
        "excluded_count" integer NOT NULL DEFAULT 0,
        "completeness" numeric NOT NULL DEFAULT 0,
        "confidence" text NOT NULL DEFAULT 'none',
        "explanation" jsonb,
        "source_hash" text,
        "error" text,
        "record_version" integer NOT NULL DEFAULT 1,
        "computed_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "ck_score_projection_status" CHECK ("status" IN
          ('stale', 'building', 'ready', 'failed')),
        CONSTRAINT "ck_score_projection_confidence" CHECK ("confidence" IN
          ('none', 'low', 'medium', 'high')),
        CONSTRAINT "ck_score_projection_counts"
          CHECK ("included_count" >= 0 AND "excluded_count" >= 0),
        CONSTRAINT "ck_score_projection_completeness"
          CHECK ("completeness" >= 0 AND "completeness" <= 1),
        CONSTRAINT "ck_score_projection_version" CHECK ("record_version" > 0)
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_score_projection_member_rule"
         ON "performance_score_projections" ("membership_id", "rule_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_score_projections_team_rank"
         ON "performance_score_projections"
          ("team_id", "overall_value" DESC NULLS LAST, "membership_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_score_projections_team_rule_key"
         ON "performance_score_projections" ("team_id", "rule_key")`,
    );
  }

  private async seedLegacyCandidate(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "calculation_rules"
        ("id", "team_id", "season_id", "rule_key", "version", "name",
         "description", "status", "scale_min", "scale_max", "min_components",
         "components")
      VALUES (
        '30300000-0000-4000-9000-000000000001', NULL, NULL, 'legacy_overall', 1,
        'Legacy equal-weight overall',
        'Equal-weight mean of Training, Technical, Tactical, Physical, Psychological, Behavioral, and Attendance. Seeded as a DRAFT candidate — never activated automatically; an administrator must approve and publish it.',
        'draft', 0, 5, 1,
        '[
          {"categoryKey": "training", "weight": 1, "minSample": 1},
          {"categoryKey": "technical", "weight": 1, "minSample": 1},
          {"categoryKey": "tactical", "weight": 1, "minSample": 1},
          {"categoryKey": "physical", "weight": 1, "minSample": 1},
          {"categoryKey": "psychological", "weight": 1, "minSample": 1},
          {"categoryKey": "behavioral", "weight": 1, "minSample": 1},
          {"categoryKey": "attendance", "weight": 1, "minSample": 1}
        ]'::jsonb
      )
      ON CONFLICT DO NOTHING
    `);
  }
}
