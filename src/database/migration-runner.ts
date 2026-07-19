import type { AppLogger } from '@core/logger';
import type { DataSource, Migration } from 'typeorm';
import { MigrationExecutor } from 'typeorm';

import {
  MIGRATION_APPLIED_LOG,
  MIGRATIONS_COMPLETED_LOG,
  MIGRATIONS_UP_TO_DATE_LOG,
} from './database.constants';

/**
 * Apply every pending migration through the DataSource, in order, one at a time,
 * logging each applied migration's name and duration (never any credentials). A
 * failure propagates so the caller can fail fast — the app must never serve
 * traffic on a partially-migrated schema. Returns the applied migration names.
 */
export async function runPendingMigrations(
  dataSource: DataSource,
  logger: AppLogger,
): Promise<readonly string[]> {
  const queryRunner = dataSource.createQueryRunner();
  await queryRunner.connect();
  try {
    const executor = new MigrationExecutor(dataSource, queryRunner);
    return await applyPendingMigrations(executor, logger);
  } finally {
    await queryRunner.release();
  }
}

async function applyPendingMigrations(
  executor: MigrationExecutor,
  logger: AppLogger,
): Promise<readonly string[]> {
  const pending = await executor.getPendingMigrations();
  if (pending.length === 0) {
    logger.info(MIGRATIONS_UP_TO_DATE_LOG);
    return [];
  }
  const applied: string[] = [];
  for (const migration of pending) {
    applied.push(await applyMigration(executor, migration, logger));
  }
  logger.info(MIGRATIONS_COMPLETED_LOG, { count: applied.length });
  return applied;
}

async function applyMigration(
  executor: MigrationExecutor,
  migration: Migration,
  logger: AppLogger,
): Promise<string> {
  const startedAt = Date.now();
  await executor.executeMigration(migration);
  logger.info(MIGRATION_APPLIED_LOG, {
    name: migration.name,
    durationMs: Date.now() - startedAt,
  });
  return migration.name;
}
