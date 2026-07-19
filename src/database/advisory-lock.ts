import type { DataSource } from 'typeorm';

import { ADVISORY_LOCK_SQL, ADVISORY_UNLOCK_SQL } from './database.constants';

/**
 * Run `work` while holding a Postgres session-level advisory lock on `key`.
 * `pg_advisory_lock` blocks other holders of the same key until this session
 * releases, so concurrent instances (or serverless cold starts) serialize the
 * boot lifecycle instead of racing on migrations/seeds. The lock is always
 * released and the connection returned, even when `work` throws.
 */
export async function withDatabaseAdvisoryLock<T>(
  dataSource: DataSource,
  key: number,
  work: () => Promise<T>,
): Promise<T> {
  const queryRunner = dataSource.createQueryRunner();
  await queryRunner.connect();
  try {
    await queryRunner.query(ADVISORY_LOCK_SQL, [key]);
    return await work();
  } finally {
    await queryRunner.query(ADVISORY_UNLOCK_SQL, [key]);
    await queryRunner.release();
  }
}
