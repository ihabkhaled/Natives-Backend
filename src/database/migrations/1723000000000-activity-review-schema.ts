import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * External training review & moderation (UN-401). Additively extends
 * `activity_submissions` with the reviewer-workflow columns and a bounded queue
 * index — it changes no existing column and creates no new table:
 *
 *   - reviewer_user_id / review_started_at  the reviewer who claimed the claim
 *                                           into review and when the lease began.
 *   - reversal_reason / reversed_at / reversed_by
 *                                           the compensating-correction record for
 *                                           an approved claim moved to `reversed`.
 *                                           The awarded points reversal itself is
 *                                           UN-402; this records the decision only.
 *   - ix_activity_submissions_review_queue  a partial covering index for the
 *                                           bounded, oldest-first reviewer queue
 *                                           over the actionable review states.
 *
 * Fully reversible: `down` drops exactly what `up` created, index before columns.
 * Proven from empty by the review integration and e2e suites (full migrate chain).
 */
export class ActivityReviewSchema1723000000000 implements MigrationInterface {
  name = 'ActivityReviewSchema1723000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "activity_submissions"
        ADD COLUMN "reviewer_user_id" uuid
          REFERENCES "users" ("id") ON DELETE SET NULL,
        ADD COLUMN "review_started_at" timestamptz,
        ADD COLUMN "reversal_reason" text,
        ADD COLUMN "reversed_at" timestamptz,
        ADD COLUMN "reversed_by" uuid
          REFERENCES "users" ("id") ON DELETE SET NULL
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_activity_submissions_review_queue"
         ON "activity_submissions"
          ("team_id", "submitted_at", "id")
        WHERE "deleted_at" IS NULL
          AND "status" IN ('submitted', 'under_review', 'changes_requested')`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "ix_activity_submissions_review_queue"`,
    );
    await queryRunner.query(`
      ALTER TABLE "activity_submissions"
        DROP COLUMN IF EXISTS "reversed_by",
        DROP COLUMN IF EXISTS "reversed_at",
        DROP COLUMN IF EXISTS "reversal_reason",
        DROP COLUMN IF EXISTS "review_started_at",
        DROP COLUMN IF EXISTS "reviewer_user_id"
    `);
  }
}
