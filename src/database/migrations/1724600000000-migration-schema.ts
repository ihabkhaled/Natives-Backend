import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Legacy migration: import framework, identity aliases, and formula comparison
 * sign-off (UN-702, UN-703, UN-704). Four additive tables; grants no new
 * permission (import.manage / import.signoff are already seeded):
 *
 *   - import_jobs          one controlled import of an audited workbook: the
 *                          workbook type, the mapper version, the SOURCE HASH
 *                          (the file itself is never stored), a dry-run flag, a
 *                          terminal status, the reconciliation counts, and a
 *                          reversal pointer. Idempotent by source hash + mapper.
 *   - import_row_results   the per-row reconciliation of a job: a row reference,
 *                          an outcome, an action, an optional entity reference,
 *                          and a redacted message — never a raw source value.
 *   - alias_resolutions    a legacy name resolved (or awaiting resolution) to a
 *                          stable player: the source alias, its normalized form,
 *                          a candidate membership with a confidence, a review
 *                          status, and the confirmed membership. Ambiguous rows
 *                          are QUARANTINED, never silently merged.
 *   - formula_comparisons  one compared metric between the normalized target
 *                          calculation and the approved legacy behavior: both
 *                          values, the difference, a discrepancy classification,
 *                          the rule versions and artifact checksum, and the named
 *                          human sign-off required before production import.
 *
 * Conventions: UUID PKs, timestamptz UTC, snake_case, check constraints
 * mirroring the enums, optimistic record_version, bounded indexes. Reversible.
 */
export class MigrationSchema1724600000000 implements MigrationInterface {
  name = 'MigrationSchema1724600000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await this.createImportJobs(queryRunner);
    await this.createRowResults(queryRunner);
    await this.createAliasResolutions(queryRunner);
    await this.createFormulaComparisons(queryRunner);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "formula_comparisons"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "alias_resolutions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "import_row_results"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "import_jobs"`);
  }

  private async createImportJobs(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "import_jobs" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "team_id" uuid NOT NULL REFERENCES "teams" ("id") ON DELETE CASCADE,
        "season_id" uuid REFERENCES "seasons" ("id") ON DELETE SET NULL,
        "workbook_type" text NOT NULL,
        "mapper_version" text NOT NULL,
        "source_hash" text NOT NULL,
        "source_name" text NOT NULL,
        "dry_run" boolean NOT NULL DEFAULT true,
        "status" text NOT NULL DEFAULT 'staged',
        "received_rows" integer NOT NULL DEFAULT 0,
        "staged_rows" integer NOT NULL DEFAULT 0,
        "committed_rows" integer NOT NULL DEFAULT 0,
        "skipped_rows" integer NOT NULL DEFAULT 0,
        "error_rows" integer NOT NULL DEFAULT 0,
        "quarantined_rows" integer NOT NULL DEFAULT 0,
        "reversal_of_job_id" uuid REFERENCES "import_jobs" ("id")
          ON DELETE SET NULL,
        "record_version" integer NOT NULL DEFAULT 1,
        "requested_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "committed_at" timestamptz,
        "reversed_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "ck_import_workbook" CHECK ("workbook_type" IN
          ('assessments', 'match_analysis', 'jerseys', 'achievements_points',
           'match_stats', 'rules', 'tryouts', 'players_2025')),
        CONSTRAINT "ck_import_status" CHECK ("status" IN
          ('staged', 'validated', 'committed', 'failed', 'reversed')),
        CONSTRAINT "ck_import_counts" CHECK
          ("received_rows" >= 0 AND "committed_rows" >= 0
            AND "skipped_rows" >= 0 AND "error_rows" >= 0)
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_import_source"
         ON "import_jobs" ("team_id", "source_hash", "mapper_version")
         WHERE "dry_run" = false`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_import_scope"
         ON "import_jobs" ("team_id", "status", "created_at" DESC, "id")`,
    );
  }

  private async createRowResults(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "import_row_results" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "team_id" uuid NOT NULL REFERENCES "teams" ("id") ON DELETE CASCADE,
        "job_id" uuid NOT NULL REFERENCES "import_jobs" ("id")
          ON DELETE CASCADE,
        "row_ref" text NOT NULL,
        "outcome" text NOT NULL,
        "action" text NOT NULL DEFAULT 'none',
        "entity_ref" text,
        "message_key" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "ck_row_outcome" CHECK ("outcome" IN
          ('staged', 'committed', 'skipped_duplicate', 'error',
           'quarantined')),
        CONSTRAINT "ck_row_action" CHECK ("action" IN
          ('none', 'created', 'updated', 'reversed'))
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_row_results_job"
         ON "import_row_results" ("job_id", "outcome", "id")`,
    );
  }

  private async createAliasResolutions(
    queryRunner: QueryRunner,
  ): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "alias_resolutions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "team_id" uuid NOT NULL REFERENCES "teams" ("id") ON DELETE CASCADE,
        "source" text NOT NULL DEFAULT 'import',
        "source_alias" text NOT NULL,
        "normalized_alias" text NOT NULL,
        "candidate_membership_id" uuid REFERENCES "memberships" ("id")
          ON DELETE SET NULL,
        "confidence" numeric(4, 3) NOT NULL DEFAULT 0,
        "status" text NOT NULL DEFAULT 'pending',
        "resolved_membership_id" uuid REFERENCES "memberships" ("id")
          ON DELETE SET NULL,
        "override" boolean NOT NULL DEFAULT false,
        "record_version" integer NOT NULL DEFAULT 1,
        "reviewed_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "reviewed_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "ck_alias_res_status" CHECK ("status" IN
          ('pending', 'confirmed', 'rejected', 'quarantined')),
        CONSTRAINT "ck_alias_res_confidence" CHECK
          ("confidence" >= 0 AND "confidence" <= 1)
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_alias_res_team_normalized"
         ON "alias_resolutions" ("team_id", "normalized_alias", "source")`,
    );
  }

  private async createFormulaComparisons(
    queryRunner: QueryRunner,
  ): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "formula_comparisons" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "team_id" uuid NOT NULL REFERENCES "teams" ("id") ON DELETE CASCADE,
        "workbook_type" text NOT NULL,
        "metric" text NOT NULL,
        "subject_ref" text NOT NULL,
        "legacy_value" numeric,
        "target_value" numeric,
        "difference" numeric,
        "classification" text NOT NULL DEFAULT 'matching',
        "legacy_rule_version" text,
        "target_rule_version" text,
        "artifact_checksum" text NOT NULL,
        "signed_off" boolean NOT NULL DEFAULT false,
        "signed_off_by_name" text,
        "record_version" integer NOT NULL DEFAULT 1,
        "signed_off_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "ck_comparison_classification" CHECK ("classification" IN
          ('matching', 'target_bug', 'legacy_defect', 'broken_reference',
           'fixed_range_omission', 'cleaning', 'missing_vs_zero',
           'version_difference', 'rounding', 'privacy_exclusion'))
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_comparison_metric_subject"
         ON "formula_comparisons" ("team_id", "workbook_type", "metric",
           "subject_ref")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_comparison_scope"
         ON "formula_comparisons" ("team_id", "workbook_type",
           "classification", "id")`,
    );
  }
}
