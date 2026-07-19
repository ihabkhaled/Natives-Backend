import type { DataSource } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';

import { withDatabaseAdvisoryLock } from './advisory-lock';
import { ADVISORY_LOCK_SQL, ADVISORY_UNLOCK_SQL } from './database.constants';

const KEY = 907_002;

function buildHarness() {
  const queryRunner = {
    connect: vi.fn().mockResolvedValue(undefined),
    query: vi.fn().mockResolvedValue(undefined),
    release: vi.fn().mockResolvedValue(undefined),
  };
  const dataSource = {
    createQueryRunner: vi.fn().mockReturnValue(queryRunner),
  };
  return { dataSource, queryRunner };
}

describe('withDatabaseAdvisoryLock', () => {
  it('acquires the lock, runs the work, then unlocks and releases', async () => {
    const harness = buildHarness();
    const work = vi.fn().mockResolvedValue('result');

    const result = await withDatabaseAdvisoryLock(
      harness.dataSource as unknown as DataSource,
      KEY,
      work,
    );

    expect(result).toBe('result');
    expect(harness.queryRunner.connect).toHaveBeenCalledOnce();
    expect(harness.queryRunner.query).toHaveBeenNthCalledWith(
      1,
      ADVISORY_LOCK_SQL,
      [KEY],
    );
    expect(work).toHaveBeenCalledOnce();
    expect(harness.queryRunner.query).toHaveBeenNthCalledWith(
      2,
      ADVISORY_UNLOCK_SQL,
      [KEY],
    );
    expect(harness.queryRunner.release).toHaveBeenCalledOnce();
  });

  it('unlocks and releases even when the work rejects', async () => {
    const harness = buildHarness();
    const work = vi.fn().mockRejectedValue(new Error('work boom'));

    await expect(
      withDatabaseAdvisoryLock(
        harness.dataSource as unknown as DataSource,
        KEY,
        work,
      ),
    ).rejects.toThrow('work boom');

    expect(harness.queryRunner.query).toHaveBeenCalledWith(
      ADVISORY_UNLOCK_SQL,
      [KEY],
    );
    expect(harness.queryRunner.release).toHaveBeenCalledOnce();
  });
});
