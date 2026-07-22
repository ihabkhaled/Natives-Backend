import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Player, team, season, and cohort analytics projections (UN-700). One additive
 * table; it changes no existing table and grants no new permission
 * (analytics.read.self / analytics.read.team are already seeded):
 *
 *   - analytics_projections   a governed READ MODEL: one row per subject
 *                             (player membership or team) per dimension per
 *                             period bucket, holding the computed value, the
 *                             SAMPLE SIZE it was derived from (so a small cohort
 *                             can be suppressed), the CALCULATION VERSION, the
 *                             source-coverage and freshness metadata, and the
 *                             instant it was computed. The value is NULLABLE:
 *                             "not evaluated" is stored as NULL, never 0, so a
 *                             chart shows a gap rather than a false zero.
 *
 * The table is rebuildable from facts: an idempotent full rebuild upserts each
 * (subject, dimension, period) row, so recomputation converges rather than
 * accumulating duplicates. Conventions: UUID PK, timestamptz UTC, snake_case,
 * check constraints mirroring the enums, bounded indexes. Reversible.
 */
export class AnalyticsSchema1724400000000 implements MigrationInterface {
  name = 'AnalyticsSchema1724400000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "analytics_projections" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "team_id" uuid NOT NULL REFERENCES "teams" ("id") ON DELETE CASCADE,
        "season_id" uuid REFERENCES "seasons" ("id") ON DELETE SET NULL,
        "subject_type" text NOT NULL,
        "subject_id" uuid,
        "dimension" text NOT NULL,
        "period_type" text NOT NULL,
        "period_key" text NOT NULL,
        "value" numeric,
        "sample_size" integer NOT NULL DEFAULT 0,
        "unit" text NOT NULL DEFAULT 'count',
        "direction" text NOT NULL DEFAULT 'neutral',
        "calculation_version" text NOT NULL,
        "source_coverage" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "computed_at" timestamptz NOT NULL DEFAULT now(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "ck_projection_subject" CHECK ("subject_type" IN
          ('player', 'team', 'cohort')),
        CONSTRAINT "ck_projection_period" CHECK ("period_type" IN
          ('daily', 'session', 'monthly', 'period', 'season', 'all_time')),
        CONSTRAINT "ck_projection_direction" CHECK ("direction" IN
          ('higher_better', 'lower_better', 'neutral')),
        CONSTRAINT "ck_projection_sample" CHECK ("sample_size" >= 0),
        CONSTRAINT "ck_projection_subject_identity" CHECK
          (("subject_type" = 'team' AND "subject_id" IS NULL)
            OR ("subject_type" <> 'team' AND "subject_id" IS NOT NULL))
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_projection_key"
         ON "analytics_projections" ("team_id",
           COALESCE("season_id", '00000000-0000-0000-0000-000000000000'::uuid),
           "subject_type",
           COALESCE("subject_id", '00000000-0000-0000-0000-000000000000'::uuid),
           "dimension", "period_type", "period_key")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_projection_series"
         ON "analytics_projections" ("team_id", "subject_type", "subject_id",
           "dimension", "period_type", "period_key")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_projection_freshness"
         ON "analytics_projections" ("team_id", "computed_at" DESC)`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "analytics_projections"`);
  }
}
