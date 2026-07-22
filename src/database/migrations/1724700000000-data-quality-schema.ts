import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Data-quality rules, anomaly queues, and repairs (UN-705). Two additive tables;
 * grants no new permission (data_quality.manage is already seeded):
 *
 *   - data_quality_anomalies   one open anomaly detected by a named rule: the
 *                              rule key and version, a severity, the FIRST and
 *                              LAST seen instants, an occurrence count, a SAFE
 *                              resource reference (ids only, never a payload), an
 *                              owner, a status, a resolution, and a suppression
 *                              expiry. Re-detecting an open anomaly bumps its
 *                              last-seen and count rather than creating a
 *                              duplicate.
 *   - data_quality_repairs     a preview/apply record of one repair: the target
 *                              anomaly, the repair kind, the previewed impact, a
 *                              terminal status, and a rollback reference. A
 *                              repair runs through domain services with a preview
 *                              first — never a raw SQL mutation.
 *
 * Conventions: UUID PKs, timestamptz UTC, snake_case, check constraints
 * mirroring the enums, optimistic record_version, bounded indexes. Reversible.
 */
export class DataQualitySchema1724700000000 implements MigrationInterface {
  name = 'DataQualitySchema1724700000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await this.createAnomalies(queryRunner);
    await this.createRepairs(queryRunner);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "data_quality_repairs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "data_quality_anomalies"`);
  }

  private async createAnomalies(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "data_quality_anomalies" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "team_id" uuid NOT NULL REFERENCES "teams" ("id") ON DELETE CASCADE,
        "rule_key" text NOT NULL,
        "rule_version" text NOT NULL,
        "severity" text NOT NULL DEFAULT 'warning',
        "resource_type" text NOT NULL,
        "resource_ref" text NOT NULL,
        "fingerprint" text NOT NULL,
        "occurrence_count" integer NOT NULL DEFAULT 1,
        "status" text NOT NULL DEFAULT 'open',
        "owner_user_id" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "resolution" text,
        "suppressed_until" timestamptz,
        "record_version" integer NOT NULL DEFAULT 1,
        "first_seen_at" timestamptz NOT NULL DEFAULT now(),
        "last_seen_at" timestamptz NOT NULL DEFAULT now(),
        "resolved_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "ck_anomaly_severity" CHECK ("severity" IN
          ('info', 'warning', 'critical')),
        CONSTRAINT "ck_anomaly_rule" CHECK ("rule_key" IN
          ('duplicate_identity', 'jersey_conflict', 'session_roster_gap',
           'attendance_after_cancellation', 'assessment_out_of_scale',
           'ledger_source_mismatch', 'orphan_points', 'score_event_mismatch',
           'stale_projection', 'missing_alias')),
        CONSTRAINT "ck_anomaly_status" CHECK ("status" IN
          ('open', 'acknowledged', 'resolved', 'suppressed')),
        CONSTRAINT "ck_anomaly_count" CHECK ("occurrence_count" > 0)
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_anomaly_fingerprint"
         ON "data_quality_anomalies" ("team_id", "fingerprint")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_anomaly_queue"
         ON "data_quality_anomalies" ("team_id", "status", "severity",
           "last_seen_at" DESC, "id")`,
    );
  }

  private async createRepairs(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "data_quality_repairs" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "team_id" uuid NOT NULL REFERENCES "teams" ("id") ON DELETE CASCADE,
        "anomaly_id" uuid NOT NULL REFERENCES "data_quality_anomalies" ("id")
          ON DELETE CASCADE,
        "repair_kind" text NOT NULL,
        "status" text NOT NULL DEFAULT 'previewed',
        "impact_count" integer NOT NULL DEFAULT 0,
        "impact_summary" text,
        "rollback_ref" text,
        "record_version" integer NOT NULL DEFAULT 1,
        "requested_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "applied_at" timestamptz,
        "rolled_back_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "ck_repair_status" CHECK ("status" IN
          ('previewed', 'applied', 'rolled_back', 'failed')),
        CONSTRAINT "ck_repair_impact" CHECK ("impact_count" >= 0)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_repair_anomaly"
         ON "data_quality_repairs" ("anomaly_id", "created_at" DESC, "id")`,
    );
  }
}
