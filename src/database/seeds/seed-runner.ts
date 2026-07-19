import type { AppLogger } from '@core/logger';
import type { DataSource } from 'typeorm';

import {
  SEED_APPLIED_LOG,
  SEED_CHANGED,
  SEED_CHECKSUM_CHANGED_LOG,
  SEED_HISTORY_INSERT_SQL,
  SEED_HISTORY_LOOKUP_SQL,
  SEED_SKIPPED,
  SEED_SKIPPED_LOG,
} from './seed.constants';
import type { Seeder, SeedHistoryRecord, SeedOutcome } from './seed.types';
import { decideSeedApplication } from './seed-policy';

/**
 * Once-only seed runner. Applies only the seeders whose key is absent from
 * `seed_history`, recording each in the SAME transaction as the seeder so the
 * effect and its ledger row commit or roll back together. A seeder whose
 * checksum drifted from the recorded one is warned about, never re-run. Runs
 * sequentially (ordered, side-effecting) — never in parallel.
 */
export async function runSeeders(
  dataSource: DataSource,
  seeders: readonly Seeder[],
  logger: AppLogger,
  appliedBy: string,
): Promise<readonly SeedOutcome[]> {
  const outcomes: SeedOutcome[] = [];
  for (const seeder of seeders) {
    outcomes.push(await runSeeder(dataSource, seeder, logger, appliedBy));
  }
  return outcomes;
}

async function runSeeder(
  dataSource: DataSource,
  seeder: Seeder,
  logger: AppLogger,
  appliedBy: string,
): Promise<SeedOutcome> {
  const existing = await lookupSeedHistory(dataSource, seeder.key);
  const application = decideSeedApplication(existing, seeder);
  if (application === SEED_CHANGED) {
    logger.warn(SEED_CHECKSUM_CHANGED_LOG, { key: seeder.key });
    return { key: seeder.key, application };
  }
  if (application === SEED_SKIPPED) {
    logger.debug(SEED_SKIPPED_LOG, { key: seeder.key });
    return { key: seeder.key, application };
  }
  await applySeeder(dataSource, seeder, appliedBy);
  logger.info(SEED_APPLIED_LOG, { key: seeder.key });
  return { key: seeder.key, application };
}

async function lookupSeedHistory(
  dataSource: DataSource,
  key: string,
): Promise<SeedHistoryRecord | null> {
  const rows = await dataSource.query<readonly SeedHistoryRecord[]>(
    SEED_HISTORY_LOOKUP_SQL,
    [key],
  );
  return rows[0] ?? null;
}

async function applySeeder(
  dataSource: DataSource,
  seeder: Seeder,
  appliedBy: string,
): Promise<void> {
  const queryRunner = dataSource.createQueryRunner();
  try {
    await queryRunner.connect();
    await queryRunner.startTransaction();
    await seeder.run({ queryRunner });
    await queryRunner.query(SEED_HISTORY_INSERT_SQL, [
      seeder.key,
      seeder.checksum,
      appliedBy,
    ]);
    await queryRunner.commitTransaction();
  } catch (error) {
    if (queryRunner.isTransactionActive) {
      await queryRunner.rollbackTransaction();
    }
    throw error;
  } finally {
    await queryRunner.release();
  }
}
