import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Report catalog and asynchronous generation (UN-701). One additive table; it
 * changes no existing table and grants no new permission (report.generate /
 * report.read are already seeded):
 *
 *   - report_jobs   an asynchronous generation job: the report TEMPLATE, its
 *                   permission/privacy class, the request parameters, the output
 *                   format, the snapshot instant, progress and a terminal status
 *                   (never an endless loading state), retry count, an expiry, the
 *                   signed download reference and CHECKSUM of the produced
 *                   artifact, the calculation version, and the audited actor.
 *                   Generation is queued and idempotent by request hash: the same
 *                   request replays to the same job rather than regenerating.
 *
 * The artifact bytes themselves are never stored in this row — only a signed
 * storage reference and a checksum. Conventions: UUID PK, timestamptz UTC,
 * snake_case, check constraints mirroring the enums, bounded indexes.
 * Reversible.
 */
export class ReportsSchema1724500000000 implements MigrationInterface {
  name = 'ReportsSchema1724500000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "report_jobs" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "team_id" uuid NOT NULL REFERENCES "teams" ("id") ON DELETE CASCADE,
        "season_id" uuid REFERENCES "seasons" ("id") ON DELETE SET NULL,
        "template" text NOT NULL,
        "format" text NOT NULL,
        "privacy_class" text NOT NULL DEFAULT 'team',
        "parameters" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "request_hash" text NOT NULL,
        "status" text NOT NULL DEFAULT 'queued',
        "progress" integer NOT NULL DEFAULT 0,
        "retry_count" integer NOT NULL DEFAULT 0,
        "calculation_version" text NOT NULL,
        "snapshot_at" timestamptz NOT NULL,
        "storage_reference" text,
        "checksum" text,
        "row_count" integer,
        "failure_reason" text,
        "expires_at" timestamptz NOT NULL,
        "record_version" integer NOT NULL DEFAULT 1,
        "requested_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "started_at" timestamptz,
        "completed_at" timestamptz,
        "failed_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "ck_report_format" CHECK ("format" IN
          ('csv', 'xlsx', 'pdf')),
        CONSTRAINT "ck_report_template" CHECK ("template" IN
          ('player_performance', 'team_overview', 'attendance',
           'training_leaderboard', 'roster', 'match_sheet', 'match_stats',
           'analysis', 'tryout_funnel', 'data_quality')),
        CONSTRAINT "ck_report_privacy" CHECK ("privacy_class" IN
          ('public', 'team', 'restricted')),
        CONSTRAINT "ck_report_status" CHECK ("status" IN
          ('queued', 'running', 'completed', 'failed', 'expired')),
        CONSTRAINT "ck_report_progress" CHECK
          ("progress" >= 0 AND "progress" <= 100),
        CONSTRAINT "ck_report_retry" CHECK ("retry_count" >= 0)
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_report_request"
         ON "report_jobs" ("team_id", "request_hash")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_report_scope"
         ON "report_jobs" ("team_id", "status", "created_at" DESC, "id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_report_expiry"
         ON "report_jobs" ("expires_at") WHERE "status" = 'completed'`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "report_jobs"`);
  }
}
