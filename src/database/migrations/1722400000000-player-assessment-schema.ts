import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Per-player assessment workflow (UN-301). A player assessment is authored by an
 * evaluator against a published template + period, moves through the review
 * workflow (draft → submitted → in_review → approved → published), and once
 * published is IMMUTABLE: a correction inserts a new superseding revision (a
 * `revised` snapshot) that shares the family and points the prior published row
 * at itself. Per-metric values are null-not-zero — a missing observation is NULL,
 * never coerced to 0. Database triggers block any content mutation or deletion of
 * a published/revised row so immutability is proven at the storage layer. This
 * migration is additive and fully reversible; it changes no existing table.
 */
export class PlayerAssessmentSchema1722400000000 implements MigrationInterface {
  name = 'PlayerAssessmentSchema1722400000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await this.createAssessments(queryRunner);
    await this.createValues(queryRunner);
    await this.createImmutabilityGuards(queryRunner);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TABLE IF EXISTS "player_assessment_metric_values"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "player_assessments"`);
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS "guard_published_player_assessment_value"()`,
    );
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS "guard_published_player_assessment"()`,
    );
  }

  private async createAssessments(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "player_assessments" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "family_id" uuid NOT NULL,
        "team_id" uuid NOT NULL REFERENCES "teams" ("id") ON DELETE CASCADE,
        "season_id" uuid REFERENCES "seasons" ("id") ON DELETE SET NULL,
        "period_id" uuid NOT NULL REFERENCES "assessment_periods" ("id")
          ON DELETE RESTRICT,
        "template_id" uuid NOT NULL REFERENCES "assessment_templates" ("id")
          ON DELETE RESTRICT,
        "membership_id" uuid NOT NULL REFERENCES "memberships" ("id")
          ON DELETE CASCADE,
        "evaluator_user_id" uuid NOT NULL REFERENCES "users" ("id")
          ON DELETE RESTRICT,
        "status" text NOT NULL DEFAULT 'draft',
        "revision" integer NOT NULL DEFAULT 1,
        "summary" text,
        "record_version" integer NOT NULL DEFAULT 1,
        "submitted_at" timestamptz,
        "submitted_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "reviewed_at" timestamptz,
        "reviewed_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "published_at" timestamptz,
        "published_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "superseded_at" timestamptz,
        "superseded_by_id" uuid REFERENCES "player_assessments" ("id")
          ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,
        "created_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "ck_player_assessment_status" CHECK ("status" IN
          ('draft', 'submitted', 'in_review', 'approved', 'published',
           'revised')),
        CONSTRAINT "ck_player_assessment_versions"
          CHECK ("revision" > 0 AND "record_version" > 0)
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_player_assessment_live"
         ON "player_assessments"
          ("period_id", "membership_id", "evaluator_user_id")
        WHERE "superseded_at" IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_player_assessments_team_list"
         ON "player_assessments"
          ("team_id", "period_id", "membership_id", "revision" DESC, "id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_player_assessments_family"
         ON "player_assessments" ("family_id", "revision")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_player_assessments_membership_published"
         ON "player_assessments"
          ("membership_id", "status", "superseded_at", "created_at")`,
    );
  }

  private async createValues(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "player_assessment_metric_values" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "assessment_id" uuid NOT NULL REFERENCES "player_assessments" ("id")
          ON DELETE CASCADE,
        "metric_definition_id" uuid NOT NULL
          REFERENCES "assessment_metric_definitions" ("id") ON DELETE RESTRICT,
        "numeric_value" numeric,
        "text_value" text,
        "note" text,
        "confidence" integer,
        "observation_count" integer,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "ux_player_assessment_value_metric"
          UNIQUE ("assessment_id", "metric_definition_id"),
        CONSTRAINT "ck_player_assessment_value_confidence"
          CHECK ("confidence" IS NULL
                 OR ("confidence" >= 0 AND "confidence" <= 5)),
        CONSTRAINT "ck_player_assessment_value_observations"
          CHECK ("observation_count" IS NULL OR "observation_count" >= 0)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_player_assessment_values_assessment"
         ON "player_assessment_metric_values"
          ("assessment_id", "metric_definition_id")`,
    );
  }

  private async createImmutabilityGuards(
    queryRunner: QueryRunner,
  ): Promise<void> {
    await queryRunner.query(`
      CREATE FUNCTION "guard_published_player_assessment"()
      RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF TG_OP = 'DELETE' THEN
          IF OLD."status" IN ('published', 'revised') THEN
            RAISE EXCEPTION 'published player assessments are immutable';
          END IF;
          RETURN OLD;
        END IF;
        IF OLD."status" IN ('published', 'revised') THEN
          IF NEW."status" IS DISTINCT FROM OLD."status"
             OR NEW."summary" IS DISTINCT FROM OLD."summary"
             OR NEW."revision" IS DISTINCT FROM OLD."revision"
             OR NEW."record_version" IS DISTINCT FROM OLD."record_version"
             OR NEW."period_id" IS DISTINCT FROM OLD."period_id"
             OR NEW."template_id" IS DISTINCT FROM OLD."template_id"
             OR NEW."membership_id" IS DISTINCT FROM OLD."membership_id"
             OR NEW."evaluator_user_id" IS DISTINCT FROM OLD."evaluator_user_id"
             OR NEW."published_at" IS DISTINCT FROM OLD."published_at"
             OR NEW."published_by" IS DISTINCT FROM OLD."published_by" THEN
            RAISE EXCEPTION 'published player assessments are immutable';
          END IF;
        END IF;
        RETURN NEW;
      END
      $$
    `);
    await queryRunner.query(`
      CREATE TRIGGER "trg_guard_published_player_assessment"
      BEFORE UPDATE OR DELETE ON "player_assessments"
      FOR EACH ROW EXECUTE FUNCTION "guard_published_player_assessment"()
    `);
    await queryRunner.query(`
      CREATE FUNCTION "guard_published_player_assessment_value"()
      RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE parent_status text;
      BEGIN
        SELECT "status" INTO parent_status FROM "player_assessments"
         WHERE "id" = COALESCE(NEW."assessment_id", OLD."assessment_id");
        IF parent_status IN ('published', 'revised') THEN
          RAISE EXCEPTION 'published player assessment values are immutable';
        END IF;
        RETURN COALESCE(NEW, OLD);
      END
      $$
    `);
    await queryRunner.query(`
      CREATE TRIGGER "trg_guard_published_player_assessment_value"
      BEFORE UPDATE OR DELETE ON "player_assessment_metric_values"
      FOR EACH ROW EXECUTE FUNCTION "guard_published_player_assessment_value"()
    `);
  }
}
