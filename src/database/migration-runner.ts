import type { AppLogger } from '@core/logger';
import type { DataSource, Migration, QueryRunner } from 'typeorm';
import { MigrationExecutor } from 'typeorm';

import {
  MIGRATION_APPLIED_LOG,
  MIGRATIONS_COMPLETED_LOG,
  MIGRATIONS_UP_TO_DATE_LOG,
} from './database.constants';

/**
 * Apply every pending migration through the DataSource, in order, one at a time,
 * logging each applied migration's name and duration (never any credentials).
 * Each migration is applied ATOMICALLY: its statements and its `migrations`
 * record commit in one transaction on the shared query runner, so a boot killed
 * mid-migration rolls back cleanly instead of stranding partial schema that
 * every later boot trips over ("relation … already exists"). TypeORM's
 * `executeMigration` itself runs without a transaction — the wrapper here is
 * what provides the guarantee. A failure propagates so the caller can fail fast
 * — the app must never serve traffic on a partially-migrated schema. Returns
 * the applied migration names.
 */
export async function runPendingMigrations(
  dataSource: DataSource,
  logger: AppLogger,
): Promise<readonly string[]> {
  const queryRunner = dataSource.createQueryRunner();
  await queryRunner.connect();
  try {
    const executor = new MigrationExecutor(dataSource, queryRunner);
    return await applyPendingMigrations(executor, queryRunner, logger);
  } finally {
    await queryRunner.release();
  }
}

async function applyPendingMigrations(
  executor: MigrationExecutor,
  queryRunner: QueryRunner,
  logger: AppLogger,
): Promise<readonly string[]> {
  const pending = await executor.getPendingMigrations();
  if (pending.length === 0) {
    logger.info(MIGRATIONS_UP_TO_DATE_LOG);
    return [];
  }
  const applied: string[] = [];
  for (const migration of pending) {
    applied.push(
      await applyMigration(executor, queryRunner, migration, logger),
    );
  }
  logger.info(MIGRATIONS_COMPLETED_LOG, { count: applied.length });
  return applied;
}

async function applyMigration(
  executor: MigrationExecutor,
  queryRunner: QueryRunner,
  migration: Migration,
  logger: AppLogger,
): Promise<string> {
  const startedAt = Date.now();
  await applyMigrationAtomically(executor, queryRunner, migration);
  logger.info(MIGRATION_APPLIED_LOG, {
    name: migration.name,
    durationMs: Date.now() - startedAt,
  });
  return migration.name;
}

/**
 * Run one migration's `up` + its completion record inside a single transaction
 * on the shared query runner (the executor was constructed with it, so every
 * statement enlists). On failure the transaction is rolled back and the ORIGINAL
 * error propagates; a rollback failure (e.g. the connection died) is deliberately
 * subordinated so it never masks the root cause.
 */
async function applyMigrationAtomically(
  executor: MigrationExecutor,
  queryRunner: QueryRunner,
  migration: Migration,
): Promise<void> {
  await queryRunner.startTransaction();
  try {
    await executor.executeMigration(migration);
    await queryRunner.commitTransaction();
  } catch (error) {
    await rollbackQuietly(queryRunner);
    throw error;
  }
}

async function rollbackQuietly(queryRunner: QueryRunner): Promise<void> {
  try {
    await queryRunner.rollbackTransaction();
  } catch {
    // The migration failure being thrown by the caller is the actionable error.
  }
}
