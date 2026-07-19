import type { AppConfigService } from '@config/app-config.service';
import type { AppLogger } from '@core/logger';
import type { DataSource } from 'typeorm';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { withDatabaseAdvisoryLock } from './advisory-lock';
import {
  DATABASE_LIFECYCLE_LOCK_KEY,
  DATABASE_LIFECYCLE_SKIPPED_LOG,
  MIGRATIONS_MANAGED_EXTERNALLY_LOG,
} from './database.constants';
import { DatabaseLifecycleService } from './database-lifecycle.service';
import { runPendingMigrations } from './migration-runner';
import { SEED_APPLIED_BY_BOOT } from './seeds/seed.constants';
import type { Seeder } from './seeds/seed.types';
import { runSeeders } from './seeds/seed-runner';

vi.mock('./advisory-lock', () => ({
  withDatabaseAdvisoryLock: vi.fn(
    (_dataSource: unknown, _key: number, work: () => Promise<void>) => work(),
  ),
}));
vi.mock('./migration-runner', () => ({
  runPendingMigrations: vi.fn().mockResolvedValue([]),
}));
vi.mock('./seeds/seed-runner', () => ({
  runSeeders: vi.fn().mockResolvedValue([]),
}));

const SEEDERS: readonly Seeder[] = [
  { key: 'admin', checksum: 'chk', run: vi.fn() },
];

function buildLogger() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    setContext: vi.fn(),
  };
}

function buildService(
  flags: { migrationsRunOnStart: boolean; seedOnStart: boolean },
  isInitialized = true,
) {
  const logger = buildLogger();
  const dataSource = { isInitialized } as unknown as DataSource;
  const config = {
    database: {
      migrationsRunOnStart: flags.migrationsRunOnStart,
      seedOnStart: flags.seedOnStart,
    },
  } as unknown as AppConfigService;
  const service = new DatabaseLifecycleService(
    dataSource,
    config,
    logger as unknown as AppLogger,
  );
  return { service, logger, dataSource };
}

describe('DatabaseLifecycleService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('logs external management and does nothing when both flags are off', async () => {
    const { service, logger } = buildService({
      migrationsRunOnStart: false,
      seedOnStart: false,
    });

    await service.run(SEEDERS);

    expect(logger.info).toHaveBeenCalledWith(MIGRATIONS_MANAGED_EXTERNALLY_LOG);
    expect(withDatabaseAdvisoryLock).not.toHaveBeenCalled();
    expect(runPendingMigrations).not.toHaveBeenCalled();
    expect(runSeeders).not.toHaveBeenCalled();
  });

  it('skips cleanly when the database is unavailable at startup', async () => {
    const { service, logger } = buildService(
      { migrationsRunOnStart: true, seedOnStart: true },
      false,
    );

    await service.run(SEEDERS);

    expect(logger.warn).toHaveBeenCalledWith(DATABASE_LIFECYCLE_SKIPPED_LOG);
    expect(withDatabaseAdvisoryLock).not.toHaveBeenCalled();
  });

  it('migrates then seeds under the advisory lock when both flags are on', async () => {
    const { service, dataSource } = buildService({
      migrationsRunOnStart: true,
      seedOnStart: true,
    });

    await service.run(SEEDERS);

    expect(withDatabaseAdvisoryLock).toHaveBeenCalledWith(
      dataSource,
      DATABASE_LIFECYCLE_LOCK_KEY,
      expect.any(Function),
    );
    expect(runPendingMigrations).toHaveBeenCalledOnce();
    expect(runSeeders).toHaveBeenCalledWith(
      dataSource,
      SEEDERS,
      expect.anything(),
      SEED_APPLIED_BY_BOOT,
    );
  });

  it('seeds without migrating when migrations-on-start is disabled', async () => {
    const { service, logger } = buildService({
      migrationsRunOnStart: false,
      seedOnStart: true,
    });

    await service.run(SEEDERS);

    expect(logger.info).toHaveBeenCalledWith(MIGRATIONS_MANAGED_EXTERNALLY_LOG);
    expect(withDatabaseAdvisoryLock).toHaveBeenCalledOnce();
    expect(runPendingMigrations).not.toHaveBeenCalled();
    expect(runSeeders).toHaveBeenCalledOnce();
  });

  it('migrates without seeding when seed-on-start is disabled', async () => {
    const { service } = buildService({
      migrationsRunOnStart: true,
      seedOnStart: false,
    });

    await service.run(SEEDERS);

    expect(runPendingMigrations).toHaveBeenCalledOnce();
    expect(runSeeders).not.toHaveBeenCalled();
  });

  it('fails fast when a migration fails', async () => {
    vi.mocked(runPendingMigrations).mockRejectedValueOnce(
      new Error('migration boom'),
    );
    const { service } = buildService({
      migrationsRunOnStart: true,
      seedOnStart: true,
    });

    await expect(service.run(SEEDERS)).rejects.toThrow('migration boom');
  });
});
