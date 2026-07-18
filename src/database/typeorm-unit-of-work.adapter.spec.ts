import { IntegrationError } from '@core/errors/integration.error';
import type { DataSource } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';

import { TypeormUnitOfWorkAdapter } from './typeorm-unit-of-work.adapter';

function createQueryRunnerMock() {
  return {
    connect: vi.fn().mockResolvedValue(undefined),
    startTransaction: vi.fn().mockResolvedValue(undefined),
    commitTransaction: vi.fn().mockResolvedValue(undefined),
    rollbackTransaction: vi.fn().mockResolvedValue(undefined),
    release: vi.fn().mockResolvedValue(undefined),
    query: vi.fn().mockResolvedValue([]),
  };
}

function createAdapter(runner: ReturnType<typeof createQueryRunnerMock>) {
  const dataSource = {
    createQueryRunner: () => runner,
  } as unknown as DataSource;
  return new TypeormUnitOfWorkAdapter(dataSource);
}

describe('TypeormUnitOfWorkAdapter', () => {
  it('commits the transaction and returns the operation result', async () => {
    const runner = createQueryRunnerMock();
    const adapter = createAdapter(runner);

    const result = await adapter.runInTransaction(async scope => {
      await scope.run('SELECT 1');
      return 'ok';
    });

    expect(result).toBe('ok');
    expect(runner.startTransaction).toHaveBeenCalledOnce();
    expect(runner.commitTransaction).toHaveBeenCalledOnce();
    expect(runner.rollbackTransaction).not.toHaveBeenCalled();
    expect(runner.release).toHaveBeenCalledOnce();
  });

  it('rolls back and raises a safe error when the operation throws', async () => {
    const runner = createQueryRunnerMock();
    const adapter = createAdapter(runner);

    await expect(
      adapter.runInTransaction(() =>
        Promise.reject(new Error('constraint violation on table users')),
      ),
    ).rejects.toBeInstanceOf(IntegrationError);

    expect(runner.rollbackTransaction).toHaveBeenCalledOnce();
    expect(runner.commitTransaction).not.toHaveBeenCalled();
    expect(runner.release).toHaveBeenCalledOnce();
  });
});
