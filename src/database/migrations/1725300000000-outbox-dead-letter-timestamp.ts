import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Dead-letter timestamp for the outbox. `dead_lettered_at` records WHEN an
 * event exhausted its attempts, so the operations listing can order and render
 * failures truthfully instead of borrowing `occurred_at`. Existing dead rows
 * are backfilled from `occurred_at` (the best recorded lower bound), a requeue
 * clears the mark, and a partial index keeps the bounded listing cheap without
 * taxing the hot pending path. Fully reversible: down drops exactly what up
 * created.
 */
export class OutboxDeadLetterTimestamp1725300000000 implements MigrationInterface {
  name = 'OutboxDeadLetterTimestamp1725300000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "outbox_events" ADD COLUMN "dead_lettered_at" timestamptz`,
    );
    await queryRunner.query(
      `UPDATE "outbox_events" SET "dead_lettered_at" = "occurred_at"
        WHERE "status" = 'dead_lettered'`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_outbox_events_dead_lettered"
        ON "outbox_events" ("dead_lettered_at" DESC)
        WHERE "status" = 'dead_lettered'`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "ix_outbox_events_dead_lettered"`,
    );
    await queryRunner.query(
      `ALTER TABLE "outbox_events" DROP COLUMN IF EXISTS "dead_lettered_at"`,
    );
  }
}
