import type { AppLogger } from '@core/logger';
import type { DataSource } from 'typeorm';
import { MigrationExecutor } from 'typeorm';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  MIGRATION_APPLIED_LOG,
  MIGRATIONS_COMPLETED_LOG,
  MIGRATIONS_UP_TO_DATE_LOG,
} from './database.constants';
import { runPendingMigrations } from './migration-runner';

vi.mock('typeorm', () => ({ MigrationExecutor: vi.fn() }));

function buildHarness(
  pending: readonly { name: string }[],
  executeMigration = vi.fn().mockResolvedValue(undefined),
) {
  const queryRunner = {
    connect: vi.fn().mockResolvedValue(undefined),
    release: vi.fn().mockResolvedValue(undefined),
    startTransaction: vi.fn().mockResolvedValue(undefined),
    commitTransaction: vi.fn().mockResolvedValue(undefined),
    rollbackTransaction: vi.fn().mockResolvedValue(undefined),
  };
  const dataSource = {
    createQueryRunner: vi.fn().mockReturnValue(queryRunner),
  };
  const getPendingMigrations = vi.fn().mockResolvedValue(pending);
  vi.mocked(MigrationExecutor).mockImplementation(
    class {
      getPendingMigrations = getPendingMigrations;
      executeMigration = executeMigration;
    } as unknown as typeof MigrationExecutor,
  );
  const logger = {
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    setContext: vi.fn(),
  };
  return {
    dataSource,
    queryRunner,
    getPendingMigrations,
    executeMigration,
    logger,
  };
}

function run(harness: ReturnType<typeof buildHarness>) {
  return runPendingMigrations(
    harness.dataSource as unknown as DataSource,
    harness.logger as unknown as AppLogger,
  );
}

describe('runPendingMigrations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('logs and returns nothing when no migrations are pending', async () => {
    const harness = buildHarness([]);

    const applied = await run(harness);

    expect(applied).toEqual([]);
    expect(harness.logger.info).toHaveBeenCalledWith(MIGRATIONS_UP_TO_DATE_LOG);
    expect(harness.executeMigration).not.toHaveBeenCalled();
    expect(harness.queryRunner.startTransaction).not.toHaveBeenCalled();
    expect(harness.queryRunner.release).toHaveBeenCalledOnce();
  });

  it('applies each pending migration in order, logging name and duration', async () => {
    const harness = buildHarness([{ name: 'A' }, { name: 'B' }]);

    const applied = await run(harness);

    expect(applied).toEqual(['A', 'B']);
    expect(harness.executeMigration).toHaveBeenCalledTimes(2);
    expect(harness.logger.info).toHaveBeenCalledWith(
      MIGRATION_APPLIED_LOG,
      expect.objectContaining({ name: 'A', durationMs: expect.any(Number) }),
    );
    expect(harness.logger.info).toHaveBeenCalledWith(MIGRATIONS_COMPLETED_LOG, {
      count: 2,
    });
    expect(harness.queryRunner.release).toHaveBeenCalledOnce();
  });

  it('wraps every migration in its own transaction (statements + record atomically)', async () => {
    const harness = buildHarness([{ name: 'A' }, { name: 'B' }]);

    await run(harness);

    expect(harness.queryRunner.startTransaction).toHaveBeenCalledTimes(2);
    expect(harness.queryRunner.commitTransaction).toHaveBeenCalledTimes(2);
    expect(harness.queryRunner.rollbackTransaction).not.toHaveBeenCalled();
    const startOrder =
      harness.queryRunner.startTransaction.mock.invocationCallOrder[0] ?? 0;
    const executeOrder =
      harness.executeMigration.mock.invocationCallOrder[0] ?? 0;
    const commitOrder =
      harness.queryRunner.commitTransaction.mock.invocationCallOrder[0] ?? 0;
    expect(startOrder).toBeLessThan(executeOrder);
    expect(executeOrder).toBeLessThan(commitOrder);
  });

  it('rolls back the failed migration, propagates, and still releases', async () => {
    const harness = buildHarness(
      [{ name: 'A' }],
      vi.fn().mockRejectedValue(new Error('migration boom')),
    );

    await expect(run(harness)).rejects.toThrow('migration boom');

    expect(harness.queryRunner.rollbackTransaction).toHaveBeenCalledOnce();
    expect(harness.queryRunner.commitTransaction).not.toHaveBeenCalled();
    expect(harness.queryRunner.release).toHaveBeenCalledOnce();
    expect(harness.logger.info).not.toHaveBeenCalledWith(
      MIGRATIONS_COMPLETED_LOG,
      expect.anything(),
    );
  });

  it('propagates the original failure even when the rollback itself fails', async () => {
    const harness = buildHarness(
      [{ name: 'A' }],
      vi.fn().mockRejectedValue(new Error('migration boom')),
    );
    harness.queryRunner.rollbackTransaction.mockRejectedValue(
      new Error('rollback failed'),
    );

    await expect(run(harness)).rejects.toThrow('migration boom');

    expect(harness.queryRunner.release).toHaveBeenCalledOnce();
  });
});
