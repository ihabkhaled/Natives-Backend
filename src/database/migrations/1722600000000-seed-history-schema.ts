import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Seed-history schema. Creates the append-only ledger the once-only seed
 * framework uses to guarantee that each seeder runs at most once per database.
 *
 * A row is inserted, in the same transaction as the seeder it records, the first
 * time a seeder with a given `seed_key` runs. On every later boot the framework
 * finds the row and skips the seeder, so a fresh database seeds exactly once and
 * an existing database never re-seeds. `checksum` captures the content-derived
 * fingerprint of the seeder definition at application time: if the definition
 * later changes, the framework logs an auditable warning instead of silently
 * re-running. Fully reversible: `down` drops exactly what `up` created.
 */
export class SeedHistorySchema1722600000000 implements MigrationInterface {
  name = 'SeedHistorySchema1722600000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "seed_history" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "seed_key" text NOT NULL,
        "checksum" text NOT NULL,
        "applied_at" timestamptz NOT NULL DEFAULT now(),
        "applied_by" text NOT NULL
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_seed_history_seed_key" ON "seed_history" ("seed_key")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "seed_history"`);
  }
}
