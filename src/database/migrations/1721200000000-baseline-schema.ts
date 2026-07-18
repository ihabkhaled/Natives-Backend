import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Baseline migration. Establishes the initial, reversible schema state for an
 * empty database. It enables the `pgcrypto` extension so future migrations can
 * generate UUID primary keys with `gen_random_uuid()`. Fully reversible: `down`
 * removes exactly what `up` created. No entities exist yet, so no tables are
 * introduced here; feature migrations build on top of this baseline.
 */
export class BaselineSchema1721200000000 implements MigrationInterface {
  name = 'BaselineSchema1721200000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP EXTENSION IF EXISTS "pgcrypto"');
  }
}
