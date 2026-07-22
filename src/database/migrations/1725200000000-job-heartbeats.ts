import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Scheduled-job heartbeats. One row per registered job, upserted after every
 * run by the interval scheduler: the last run instant, its outcome, and the
 * count of CONSECUTIVE failures (reset to zero on success). The jobs-health
 * endpoint derives its status purely from these recorded facts — a job that
 * never ran simply has no row, and honesty demands that reads as `degraded`,
 * never as a fabricated success. Fully reversible: down drops the table.
 */
export class JobHeartbeats1725200000000 implements MigrationInterface {
  name = 'JobHeartbeats1725200000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "job_heartbeats" (
        "job_key" text PRIMARY KEY,
        "last_run_at" timestamptz NOT NULL,
        "last_outcome" text NOT NULL
          CONSTRAINT "ck_job_heartbeats_outcome"
          CHECK ("last_outcome" IN ('succeeded','failed')),
        "failure_count" integer NOT NULL DEFAULT 0,
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "job_heartbeats"`);
  }
}
