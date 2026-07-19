import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Player development bounded context (UN-302): coach feedback, its player
 * acknowledgement, development goals, and action-plan steps.
 *
 * Coach feedback moves through draft → in_review → published → revised. A draft
 * is the author's private working copy; publishing shares it with the member;
 * once published a record is IMMUTABLE — a correction inserts a new superseding
 * revision (a `revised` snapshot sharing the family). The private coach note lives
 * on the same row but is never projected to a member view. Database triggers block
 * any content mutation or deletion of a published/revised row, so immutability is
 * proven at the storage layer while still permitting the supersede bookkeeping.
 *
 * Development goals carry measurable targets (null-not-zero numerics), an
 * action-plan child collection, an optimistic version, and a soft-delete column.
 * This migration is additive and fully reversible; it changes no existing table.
 */
export class DevelopmentSchema1722500000000 implements MigrationInterface {
  name = 'DevelopmentSchema1722500000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await this.createFeedback(queryRunner);
    await this.createAcknowledgements(queryRunner);
    await this.createGoals(queryRunner);
    await this.createGoalActions(queryRunner);
    await this.createImmutabilityGuard(queryRunner);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "development_goal_actions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "development_goals"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "feedback_acknowledgements"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "coach_feedback"`);
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS "guard_published_coach_feedback"()`,
    );
  }

  private async createFeedback(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "coach_feedback" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "family_id" uuid NOT NULL,
        "team_id" uuid NOT NULL REFERENCES "teams" ("id") ON DELETE CASCADE,
        "season_id" uuid REFERENCES "seasons" ("id") ON DELETE SET NULL,
        "membership_id" uuid NOT NULL REFERENCES "memberships" ("id")
          ON DELETE CASCADE,
        "author_user_id" uuid NOT NULL REFERENCES "users" ("id")
          ON DELETE RESTRICT,
        "status" text NOT NULL DEFAULT 'draft',
        "revision" integer NOT NULL DEFAULT 1,
        "record_version" integer NOT NULL DEFAULT 1,
        "positive_frisbee" text,
        "frisbee_improvement" text,
        "positive_mental" text,
        "mental_improvement" text,
        "team_role" text,
        "recommended_position" text,
        "summary" text,
        "coach_note" text,
        "submitted_at" timestamptz,
        "submitted_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "published_at" timestamptz,
        "published_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "superseded_at" timestamptz,
        "superseded_by_id" uuid REFERENCES "coach_feedback" ("id")
          ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,
        "created_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "ck_coach_feedback_status" CHECK ("status" IN
          ('draft', 'in_review', 'published', 'revised')),
        CONSTRAINT "ck_coach_feedback_versions"
          CHECK ("revision" > 0 AND "record_version" > 0)
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_coach_feedback_family_live"
         ON "coach_feedback" ("family_id") WHERE "superseded_at" IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_coach_feedback_team_list"
         ON "coach_feedback" ("team_id", "created_at" DESC, "id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_coach_feedback_member"
         ON "coach_feedback"
          ("membership_id", "status", "superseded_at", "published_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_coach_feedback_family"
         ON "coach_feedback" ("family_id", "revision")`,
    );
  }

  private async createAcknowledgements(
    queryRunner: QueryRunner,
  ): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "feedback_acknowledgements" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "feedback_id" uuid NOT NULL REFERENCES "coach_feedback" ("id")
          ON DELETE CASCADE,
        "membership_id" uuid NOT NULL REFERENCES "memberships" ("id")
          ON DELETE CASCADE,
        "user_id" uuid NOT NULL REFERENCES "users" ("id") ON DELETE RESTRICT,
        "acknowledged_at" timestamptz NOT NULL DEFAULT now(),
        "clarification_requested" boolean NOT NULL DEFAULT false,
        "clarification_note" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "ux_feedback_acknowledgement_once" UNIQUE ("feedback_id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_feedback_acknowledgements_member"
         ON "feedback_acknowledgements" ("membership_id", "acknowledged_at")`,
    );
  }

  private async createGoals(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "development_goals" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "team_id" uuid NOT NULL REFERENCES "teams" ("id") ON DELETE CASCADE,
        "season_id" uuid REFERENCES "seasons" ("id") ON DELETE SET NULL,
        "membership_id" uuid NOT NULL REFERENCES "memberships" ("id")
          ON DELETE CASCADE,
        "feedback_id" uuid REFERENCES "coach_feedback" ("id")
          ON DELETE SET NULL,
        "metric_definition_id" uuid
          REFERENCES "assessment_metric_definitions" ("id") ON DELETE SET NULL,
        "owner_user_id" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "title" text NOT NULL,
        "description" text,
        "measurable_target" text,
        "target_value" numeric,
        "baseline_value" numeric,
        "progress_value" numeric,
        "progress_note" text,
        "evidence" text,
        "status" text NOT NULL DEFAULT 'proposed',
        "due_date" date,
        "completed_at" timestamptz,
        "review_note" text,
        "reviewed_at" timestamptz,
        "reviewed_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "record_version" integer NOT NULL DEFAULT 1,
        "created_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,
        CONSTRAINT "ck_development_goal_status" CHECK ("status" IN
          ('proposed', 'active', 'achieved', 'missed', 'cancelled')),
        CONSTRAINT "ck_development_goal_version" CHECK ("record_version" > 0)
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_development_goal_metric_open"
         ON "development_goals" ("membership_id", "metric_definition_id")
        WHERE "deleted_at" IS NULL AND "metric_definition_id" IS NOT NULL
          AND "status" IN ('proposed', 'active')`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_development_goals_team_list"
         ON "development_goals" ("team_id", "created_at" DESC, "id")
        WHERE "deleted_at" IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_development_goals_member"
         ON "development_goals" ("membership_id", "status")
        WHERE "deleted_at" IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_development_goals_overdue"
         ON "development_goals" ("team_id", "status", "due_date")
        WHERE "deleted_at" IS NULL`,
    );
  }

  private async createGoalActions(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "development_goal_actions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "goal_id" uuid NOT NULL REFERENCES "development_goals" ("id")
          ON DELETE CASCADE,
        "description" text NOT NULL,
        "sort_order" integer NOT NULL DEFAULT 0,
        "done" boolean NOT NULL DEFAULT false,
        "due_date" date,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "ux_development_goal_action_order"
          UNIQUE ("goal_id", "sort_order")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_development_goal_actions_goal"
         ON "development_goal_actions" ("goal_id", "sort_order")`,
    );
  }

  private async createImmutabilityGuard(
    queryRunner: QueryRunner,
  ): Promise<void> {
    await queryRunner.query(`
      CREATE FUNCTION "guard_published_coach_feedback"()
      RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF TG_OP = 'DELETE' THEN
          IF OLD."status" IN ('published', 'revised') THEN
            RAISE EXCEPTION 'published coach feedback is immutable';
          END IF;
          RETURN OLD;
        END IF;
        IF OLD."status" IN ('published', 'revised') THEN
          IF NEW."status" IS DISTINCT FROM OLD."status"
             OR NEW."revision" IS DISTINCT FROM OLD."revision"
             OR NEW."record_version" IS DISTINCT FROM OLD."record_version"
             OR NEW."membership_id" IS DISTINCT FROM OLD."membership_id"
             OR NEW."author_user_id" IS DISTINCT FROM OLD."author_user_id"
             OR NEW."positive_frisbee" IS DISTINCT FROM OLD."positive_frisbee"
             OR NEW."frisbee_improvement"
                  IS DISTINCT FROM OLD."frisbee_improvement"
             OR NEW."positive_mental" IS DISTINCT FROM OLD."positive_mental"
             OR NEW."mental_improvement"
                  IS DISTINCT FROM OLD."mental_improvement"
             OR NEW."team_role" IS DISTINCT FROM OLD."team_role"
             OR NEW."recommended_position"
                  IS DISTINCT FROM OLD."recommended_position"
             OR NEW."summary" IS DISTINCT FROM OLD."summary"
             OR NEW."coach_note" IS DISTINCT FROM OLD."coach_note"
             OR NEW."published_at" IS DISTINCT FROM OLD."published_at"
             OR NEW."published_by" IS DISTINCT FROM OLD."published_by" THEN
            RAISE EXCEPTION 'published coach feedback is immutable';
          END IF;
        END IF;
        RETURN NEW;
      END
      $$
    `);
    await queryRunner.query(`
      CREATE TRIGGER "trg_guard_published_coach_feedback"
      BEFORE UPDATE OR DELETE ON "coach_feedback"
      FOR EACH ROW EXECUTE FUNCTION "guard_published_coach_feedback"()
    `);
  }
}
