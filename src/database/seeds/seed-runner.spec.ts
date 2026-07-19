import type { AppLogger } from '@core/logger';
import type { DataSource } from 'typeorm';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  SEED_APPLIED_BY_BOOT,
  SEED_APPLIED_LOG,
  SEED_CHECKSUM_CHANGED_LOG,
  SEED_SKIPPED_LOG,
} from './seed.constants';
import type { Seeder } from './seed.types';
import { runSeeders } from './seed-runner';

function buildHarness(lookupRows: readonly { checksum: string }[]) {
  let transactionActive = false;
  const queryRunner = {
    get isTransactionActive() {
      return transactionActive;
    },
    connect: vi.fn().mockResolvedValue(undefined),
    startTransaction: vi.fn(() => {
      transactionActive = true;
      return Promise.resolve();
    }),
    commitTransaction: vi.fn(() => {
      transactionActive = false;
      return Promise.resolve();
    }),
    rollbackTransaction: vi.fn(() => {
      transactionActive = false;
      return Promise.resolve();
    }),
    release: vi.fn().mockResolvedValue(undefined),
    query: vi.fn().mockResolvedValue(undefined),
  };
  const dataSource = {
    query: vi.fn().mockResolvedValue(lookupRows),
    createQueryRunner: vi.fn().mockReturnValue(queryRunner),
  };
  const logger = {
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    setContext: vi.fn(),
  };
  return { dataSource, queryRunner, logger };
}

function buildSeeder(overrides: Partial<Seeder> = {}): Seeder {
  return {
    key: 'admin',
    checksum: 'chk',
    run: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function run(
  harness: ReturnType<typeof buildHarness>,
  seeders: readonly Seeder[],
) {
  return runSeeders(
    harness.dataSource as unknown as DataSource,
    seeders,
    harness.logger as unknown as AppLogger,
    SEED_APPLIED_BY_BOOT,
  );
}

describe('runSeeders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('applies a seeder absent from history and records it in one transaction', async () => {
    const harness = buildHarness([]);
    const seeder = buildSeeder();

    const outcomes = await run(harness, [seeder]);

    expect(outcomes).toEqual([{ key: 'admin', application: 'applied' }]);
    expect(seeder.run).toHaveBeenCalledWith({
      queryRunner: harness.queryRunner,
    });
    expect(harness.queryRunner.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO "seed_history"'),
      ['admin', 'chk', SEED_APPLIED_BY_BOOT],
    );
    expect(harness.queryRunner.commitTransaction).toHaveBeenCalledOnce();
    expect(harness.queryRunner.release).toHaveBeenCalledOnce();
    expect(harness.logger.info).toHaveBeenCalledWith(SEED_APPLIED_LOG, {
      key: 'admin',
    });
  });

  it('skips a seeder whose checksum already matches history', async () => {
    const harness = buildHarness([{ checksum: 'chk' }]);
    const seeder = buildSeeder();

    const outcomes = await run(harness, [seeder]);

    expect(outcomes).toEqual([{ key: 'admin', application: 'skipped' }]);
    expect(seeder.run).not.toHaveBeenCalled();
    expect(harness.dataSource.createQueryRunner).not.toHaveBeenCalled();
    expect(harness.logger.debug).toHaveBeenCalledWith(SEED_SKIPPED_LOG, {
      key: 'admin',
    });
  });

  it('warns and does not re-run when the recorded checksum drifted', async () => {
    const harness = buildHarness([{ checksum: 'other' }]);
    const seeder = buildSeeder();

    const outcomes = await run(harness, [seeder]);

    expect(outcomes).toEqual([{ key: 'admin', application: 'changed' }]);
    expect(seeder.run).not.toHaveBeenCalled();
    expect(harness.logger.warn).toHaveBeenCalledWith(
      SEED_CHECKSUM_CHANGED_LOG,
      {
        key: 'admin',
      },
    );
  });

  it('rolls back and rethrows when a seeder fails mid-transaction', async () => {
    const harness = buildHarness([]);
    const seeder = buildSeeder({
      run: vi.fn().mockRejectedValue(new Error('seed boom')),
    });

    await expect(run(harness, [seeder])).rejects.toThrow('seed boom');

    expect(harness.queryRunner.rollbackTransaction).toHaveBeenCalledOnce();
    expect(harness.queryRunner.commitTransaction).not.toHaveBeenCalled();
    expect(harness.queryRunner.release).toHaveBeenCalledOnce();
  });

  it('does not roll back when the transaction never started and still releases', async () => {
    const harness = buildHarness([]);
    harness.queryRunner.connect.mockRejectedValueOnce(new Error('no connect'));
    const seeder = buildSeeder();

    await expect(run(harness, [seeder])).rejects.toThrow('no connect');

    expect(harness.queryRunner.startTransaction).not.toHaveBeenCalled();
    expect(harness.queryRunner.rollbackTransaction).not.toHaveBeenCalled();
    expect(harness.queryRunner.release).toHaveBeenCalledOnce();
  });

  it('processes multiple seeders in order', async () => {
    const harness = buildHarness([]);
    const outcomes = await run(harness, [
      buildSeeder({ key: 'a' }),
      buildSeeder({ key: 'b' }),
    ]);

    expect(outcomes.map(outcome => outcome.key)).toEqual(['a', 'b']);
  });
});
