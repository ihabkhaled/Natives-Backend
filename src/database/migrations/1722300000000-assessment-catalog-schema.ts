import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Assessment catalog foundation (UN-300). Definitions and templates are
 * append-versioned: downstream assessment rows pin concrete version UUIDs.
 * Seed data is stable and idempotent, all lists have covering order indexes,
 * and no existing table or column is changed.
 */
export class AssessmentCatalogSchema1722300000000 implements MigrationInterface {
  name = 'AssessmentCatalogSchema1722300000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await this.createCategories(queryRunner);
    await this.createScales(queryRunner);
    await this.createMetrics(queryRunner);
    await this.createTemplates(queryRunner);
    await this.createTemplateWeights(queryRunner);
    await this.createTemplateMetrics(queryRunner);
    await this.createPeriods(queryRunner);
    await this.createImmutabilityGuards(queryRunner);
    await this.seedCatalog(queryRunner);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "assessment_periods"`);
    await queryRunner.query(
      `DROP TABLE IF EXISTS "assessment_template_metrics"`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "assessment_template_category_weights"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "assessment_templates"`);
    await queryRunner.query(
      `DROP TABLE IF EXISTS "assessment_metric_definitions"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "assessment_scales"`);
    await queryRunner.query(
      `DROP TABLE IF EXISTS "assessment_metric_categories"`,
    );
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS "guard_used_assessment_metric"()`,
    );
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS "guard_published_assessment_template"()`,
    );
  }

  private async createCategories(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "assessment_metric_categories" (
        "id" uuid PRIMARY KEY,
        "category_key" text NOT NULL,
        "name" text NOT NULL,
        "description" text NOT NULL,
        "sort_order" integer NOT NULL,
        "status" text NOT NULL DEFAULT 'active',
        "version" integer NOT NULL DEFAULT 1,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "ux_assessment_category_key" UNIQUE ("category_key"),
        CONSTRAINT "ck_assessment_category_status"
          CHECK ("status" IN ('active', 'archived')),
        CONSTRAINT "ck_assessment_category_version" CHECK ("version" > 0),
        CONSTRAINT "ck_assessment_category_sort" CHECK ("sort_order" >= 0)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_assessment_categories_order"
         ON "assessment_metric_categories" ("sort_order", "category_key", "id")`,
    );
  }

  private async createScales(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "assessment_scales" (
        "id" uuid PRIMARY KEY,
        "scale_key" text NOT NULL,
        "name" text NOT NULL,
        "value_kind" text NOT NULL,
        "unit" text,
        "minimum_value" numeric,
        "maximum_value" numeric,
        "step_value" numeric,
        "categorical_options" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "guidance" text NOT NULL,
        "status" text NOT NULL DEFAULT 'active',
        "scale_version" integer NOT NULL DEFAULT 1,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "ux_assessment_scale_key_version"
          UNIQUE ("scale_key", "scale_version"),
        CONSTRAINT "ck_assessment_scale_kind" CHECK ("value_kind" IN
          ('legacy_0_5', 'timed', 'count', 'percentage', 'categorical', 'text')),
        CONSTRAINT "ck_assessment_scale_status"
          CHECK ("status" IN ('active', 'archived')),
        CONSTRAINT "ck_assessment_scale_version" CHECK ("scale_version" > 0),
        CONSTRAINT "ck_assessment_scale_bounds" CHECK
          ("minimum_value" IS NULL OR "maximum_value" IS NULL
           OR "minimum_value" <= "maximum_value"),
        CONSTRAINT "ck_assessment_scale_step" CHECK
          ("step_value" IS NULL OR "step_value" > 0),
        CONSTRAINT "ck_assessment_scale_options" CHECK
          (jsonb_typeof("categorical_options") = 'array')
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_assessment_scales_order"
         ON "assessment_scales" ("scale_key", "scale_version", "id")`,
    );
  }

  private async createMetrics(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "assessment_metric_definitions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "family_id" uuid NOT NULL,
        "team_id" uuid REFERENCES "teams" ("id") ON DELETE CASCADE,
        "category_id" uuid NOT NULL REFERENCES "assessment_metric_categories" ("id")
          ON DELETE RESTRICT,
        "scale_id" uuid NOT NULL REFERENCES "assessment_scales" ("id")
          ON DELETE RESTRICT,
        "definition_key" text NOT NULL,
        "name" text NOT NULL,
        "definition" text NOT NULL,
        "direction" text NOT NULL,
        "guidance" text NOT NULL,
        "applicability" text[] NOT NULL DEFAULT '{}',
        "tags" text[] NOT NULL DEFAULT '{}',
        "status" text NOT NULL DEFAULT 'active',
        "definition_version" integer NOT NULL,
        "record_version" integer NOT NULL DEFAULT 1,
        "created_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "archived_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "archived_at" timestamptz,
        CONSTRAINT "ck_assessment_metric_direction" CHECK ("direction" IN
          ('higher_is_better', 'lower_is_better', 'target_range', 'descriptive')),
        CONSTRAINT "ck_assessment_metric_status"
          CHECK ("status" IN ('active', 'archived')),
        CONSTRAINT "ck_assessment_metric_versions"
          CHECK ("definition_version" > 0 AND "record_version" > 0)
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_assessment_metric_scope_key_version"
         ON "assessment_metric_definitions"
          (COALESCE("team_id", '00000000-0000-0000-0000-000000000000'::uuid),
           "definition_key", "definition_version")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_assessment_metrics_scope_current"
         ON "assessment_metric_definitions"
          ("team_id", "family_id", "definition_version" DESC, "id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_assessment_metrics_category"
         ON "assessment_metric_definitions"
          ("category_id", "status", "definition_key", "id")`,
    );
  }

  private async createTemplates(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "assessment_templates" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "family_id" uuid NOT NULL,
        "team_id" uuid NOT NULL REFERENCES "teams" ("id") ON DELETE CASCADE,
        "season_id" uuid REFERENCES "seasons" ("id") ON DELETE SET NULL,
        "template_key" text NOT NULL,
        "name" text NOT NULL,
        "cohort" text,
        "evaluator_roles" text[] NOT NULL,
        "score_version" integer NOT NULL,
        "status" text NOT NULL DEFAULT 'draft',
        "template_version" integer NOT NULL,
        "record_version" integer NOT NULL DEFAULT 1,
        "published_at" timestamptz,
        "published_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "created_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "ux_assessment_template_scope_key_version"
          UNIQUE ("team_id", "template_key", "template_version"),
        CONSTRAINT "ux_assessment_template_family_version"
          UNIQUE ("team_id", "family_id", "template_version"),
        CONSTRAINT "ck_assessment_template_status"
          CHECK ("status" IN ('draft', 'published', 'archived')),
        CONSTRAINT "ck_assessment_template_versions"
          CHECK ("template_version" > 0 AND "record_version" > 0
                 AND "score_version" > 0),
        CONSTRAINT "ck_assessment_template_evaluators"
          CHECK (cardinality("evaluator_roles") > 0)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_assessment_templates_scope_list"
         ON "assessment_templates"
          ("team_id", "season_id", "template_key", "template_version" DESC, "id")`,
    );
  }

  private async createTemplateWeights(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "assessment_template_category_weights" (
        "template_id" uuid NOT NULL REFERENCES "assessment_templates" ("id")
          ON DELETE CASCADE,
        "category_id" uuid NOT NULL REFERENCES "assessment_metric_categories" ("id")
          ON DELETE RESTRICT,
        "weight_percentage" integer NOT NULL,
        PRIMARY KEY ("template_id", "category_id"),
        CONSTRAINT "ck_assessment_category_weight"
          CHECK ("weight_percentage" > 0 AND "weight_percentage" <= 100)
      )
    `);
  }

  private async createTemplateMetrics(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "assessment_template_metrics" (
        "template_id" uuid NOT NULL REFERENCES "assessment_templates" ("id")
          ON DELETE CASCADE,
        "metric_definition_id" uuid NOT NULL
          REFERENCES "assessment_metric_definitions" ("id") ON DELETE RESTRICT,
        "required" boolean NOT NULL DEFAULT true,
        "sort_order" integer NOT NULL,
        PRIMARY KEY ("template_id", "metric_definition_id"),
        CONSTRAINT "ux_assessment_template_metric_order"
          UNIQUE ("template_id", "sort_order"),
        CONSTRAINT "ck_assessment_template_metric_sort" CHECK ("sort_order" >= 0)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_assessment_template_metrics_definition"
         ON "assessment_template_metrics" ("metric_definition_id", "template_id")`,
    );
  }

  private async createPeriods(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "assessment_periods" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "team_id" uuid NOT NULL REFERENCES "teams" ("id") ON DELETE CASCADE,
        "season_id" uuid REFERENCES "seasons" ("id") ON DELETE SET NULL,
        "template_id" uuid NOT NULL REFERENCES "assessment_templates" ("id")
          ON DELETE RESTRICT,
        "name" text NOT NULL,
        "cohort" text,
        "starts_on" date NOT NULL,
        "ends_on" date NOT NULL,
        "status" text NOT NULL DEFAULT 'active',
        "record_version" integer NOT NULL DEFAULT 1,
        "created_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "ck_assessment_period_dates" CHECK ("starts_on" <= "ends_on"),
        CONSTRAINT "ck_assessment_period_status"
          CHECK ("status" IN ('active', 'archived')),
        CONSTRAINT "ck_assessment_period_version" CHECK ("record_version" > 0)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_assessment_periods_scope_dates"
         ON "assessment_periods"
          ("team_id", "season_id", "starts_on", "ends_on", "id")`,
    );
  }

  private async createImmutabilityGuards(
    queryRunner: QueryRunner,
  ): Promise<void> {
    await queryRunner.query(`
      CREATE FUNCTION "guard_used_assessment_metric"()
      RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM "assessment_template_metrics"
           WHERE "metric_definition_id" = OLD."id"
        ) THEN
          RAISE EXCEPTION 'used assessment metric definitions are immutable';
        END IF;
        RETURN NEW;
      END
      $$
    `);
    await queryRunner.query(`
      CREATE TRIGGER "trg_guard_used_assessment_metric"
      BEFORE UPDATE OR DELETE ON "assessment_metric_definitions"
      FOR EACH ROW EXECUTE FUNCTION "guard_used_assessment_metric"()
    `);
    await queryRunner.query(`
      CREATE FUNCTION "guard_published_assessment_template"()
      RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF OLD."status" = 'published' THEN
          RAISE EXCEPTION 'published assessment template versions are immutable';
        END IF;
        RETURN NEW;
      END
      $$
    `);
    await queryRunner.query(`
      CREATE TRIGGER "trg_guard_published_assessment_template"
      BEFORE UPDATE OR DELETE ON "assessment_templates"
      FOR EACH ROW EXECUTE FUNCTION "guard_published_assessment_template"()
    `);
  }

  private async seedCatalog(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "assessment_metric_categories"
        ("id", "category_key", "name", "description", "sort_order")
      VALUES
        ('30000000-0000-4000-8000-000000000001', 'technical', 'Technical',
         'Disc skills and individual execution quality.', 10),
        ('30000000-0000-4000-8000-000000000002', 'tactical', 'Tactical',
         'Game decisions, positioning, systems, and team awareness.', 20),
        ('30000000-0000-4000-8000-000000000003', 'physical', 'Physical',
         'Athletic capacity and movement qualities.', 30),
        ('30000000-0000-4000-8000-000000000004', 'psychological', 'Psychological',
         'Mental readiness, focus, confidence, and resilience.', 40),
        ('30000000-0000-4000-8000-000000000005', 'behavioral', 'Behavioral',
         'Team conduct, reliability, leadership, and coachability.', 50),
        ('30000000-0000-4000-8000-000000000006', 'training', 'Training',
         'Training-process and development-plan metrics.', 60),
        ('30000000-0000-4000-8000-000000000007', 'custom', 'Custom',
         'Team-defined metrics that do not fit the audited categories.', 70)
      ON CONFLICT ("category_key") DO NOTHING
    `);
    await queryRunner.query(`
      INSERT INTO "assessment_scales"
        ("id", "scale_key", "name", "value_kind", "unit", "minimum_value",
         "maximum_value", "step_value", "categorical_options", "guidance")
      VALUES
        ('30000000-0000-4000-8100-000000000001', 'legacy_0_5', 'Legacy 0–5',
         'legacy_0_5', 'rating', 0, 5, 1, '[]',
         '0 is an observed lowest score; unknown or not observed must be null.'),
        ('30000000-0000-4000-8100-000000000002', 'timed_seconds', 'Timed seconds',
         'timed', 'seconds', 0, NULL, 0.01, '[]',
         'Record elapsed seconds; direction is selected by the metric.'),
        ('30000000-0000-4000-8100-000000000003', 'count', 'Count',
         'count', 'count', 0, NULL, 1, '[]',
         'Record a non-negative observed count; unknown remains null.'),
        ('30000000-0000-4000-8100-000000000004', 'percentage', 'Percentage',
         'percentage', 'percent', 0, 100, 0.01, '[]',
         'Record an observed percentage from 0 through 100.'),
        ('30000000-0000-4000-8100-000000000005', 'categorical', 'Categorical',
         'categorical', NULL, NULL, NULL, NULL,
         '["emerging","developing","proficient","advanced"]',
         'Choose exactly one documented category; unknown remains null.'),
        ('30000000-0000-4000-8100-000000000006', 'text', 'Text observation',
         'text', NULL, NULL, NULL, NULL, '[]',
         'Record a bounded qualitative observation; not evaluated is null.')
      ON CONFLICT ("scale_key", "scale_version") DO NOTHING
    `);
    await this.seedMetricGroup(queryRunner, 'technical', [
      ['handling', 'Handling', 'Maintains secure, balanced disc control under pressure.'],
      ['short_throws', 'Short Throws', 'Completes accurate short-range throws with appropriate touch.'],
      ['long_throws', 'Long Throws', 'Delivers accurate, catchable long-range throws.'],
      ['vision', 'Vision', 'Scans the field and identifies developing options early.'],
      ['playmaking', 'Playmaking', 'Creates advantageous continuation opportunities for teammates.'],
      ['catching', 'Catching', 'Secures routine and contested catches with sound technique.'],
      ['jumping', 'Jumping', 'Times and controls aerial contests safely and effectively.'],
      ['cutting', 'Cutting', 'Creates separation with timing, angles, and changes of pace.'],
      ['dribbling', 'Dribbling', 'Uses legal rapid give-go movement to advance possession.'],
      ['defense', 'Defense', 'Applies effective marking and matchup positioning without fouling.'],
    ]);
    await this.seedMetricGroup(queryRunner, 'tactical', [
      ['decision_making', 'Decision-making', 'Selects appropriate options for game context and risk.'],
      ['positioning', 'Positioning', 'Occupies effective space relative to disc, teammates, and threats.'],
      ['game_awareness', 'Game Awareness', 'Tracks score, time, matchups, and evolving field state.'],
      ['communication', 'Communication', 'Shares timely, actionable information with teammates.'],
      ['adaptability', 'Adaptability', 'Adjusts execution when opponents, conditions, or roles change.'],
      ['stack_formation', 'Stack/Formation', 'Maintains and restores the team formation and spacing.'],
    ]);
    await this.seedMetricGroup(queryRunner, 'physical', [
      ['speed', 'Speed', 'Reaches useful running speed for offensive and defensive actions.'],
      ['agility', 'Agility', 'Changes direction efficiently while maintaining control.'],
      ['strength', 'Strength', 'Produces and absorbs sport-relevant force safely.'],
      ['stamina', 'Stamina', 'Sustains effective work rate across repeated points.'],
      ['reaction', 'Reaction', 'Responds quickly and appropriately to visual and game cues.'],
    ]);
    await this.seedMetricGroup(queryRunner, 'psychological', [
      ['confidence', 'Confidence', 'Acts decisively with realistic belief in current capability.'],
      ['mindset', 'Mindset', 'Approaches challenge and feedback with a growth orientation.'],
      ['focus', 'Focus', 'Maintains attention on relevant cues and the current assignment.'],
      ['resilience', 'Resilience', 'Recovers constructively after errors, setbacks, or pressure.'],
      ['motivation', 'Motivation', 'Shows sustained intent to train, compete, and improve.'],
      ['spirit', 'Spirit', 'Upholds fair play, respect, and self-officiation responsibilities.'],
      ['composure', 'Composure', 'Regulates emotion and decision quality in high-pressure moments.'],
    ]);
    await this.seedMetricGroup(queryRunner, 'behavioral', [
      ['teamwork', 'Teamwork', 'Contributes reliably to shared team outcomes.'],
      ['coachability', 'Coachability', 'Receives, clarifies, and applies constructive feedback.'],
      ['attitude', 'Attitude', 'Demonstrates constructive energy and respect toward others.'],
      ['consistency', 'Consistency', 'Repeats expected preparation, effort, and execution habits.'],
      ['leadership', 'Leadership', 'Improves collective clarity, standards, and confidence.'],
    ]);
  }

  private async seedMetricGroup(
    queryRunner: QueryRunner,
    categoryKey: string,
    metrics: readonly (readonly [string, string, string])[],
  ): Promise<void> {
    for (let index = 0; index < metrics.length; index += 1) {
      const metric = metrics[index];
      if (metric === undefined) {
        continue;
      }
      await queryRunner.query(
        `WITH seed AS (SELECT gen_random_uuid() AS "id")
         INSERT INTO "assessment_metric_definitions"
          ("id", "family_id", "category_id", "scale_id", "definition_key",
           "name", "definition", "direction", "guidance", "applicability",
           "tags", "definition_version")
         SELECT seed."id", seed."id", c."id", s."id", $1, $2, $3,
                'higher_is_better',
                'Use observable behavior from the defined assessment period; use null when not observed.',
                ARRAY['player'], ARRAY[$4], 1
           FROM seed
           CROSS JOIN "assessment_metric_categories" c
           CROSS JOIN "assessment_scales" s
          WHERE c."category_key" = $5
            AND s."scale_key" = 'legacy_0_5'
         ON CONFLICT DO NOTHING`,
        [
          metric[0],
          metric[1],
          metric[2],
          categoryKey,
          categoryKey,
        ],
      );
    }
  }
}
