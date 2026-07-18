import type { QueryRunner } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';

import { TypeormTransactionScope } from './typeorm-transaction-scope';

describe('TypeormTransactionScope', () => {
  it('runs a statement without parameters through the query runner', async () => {
    const query = vi.fn().mockResolvedValue([{ value: 1 }]);
    const scope = new TypeormTransactionScope({
      query,
    } as unknown as QueryRunner);

    const rows = await scope.run('SELECT 1');

    expect(query).toHaveBeenCalledWith('SELECT 1', undefined);
    expect(rows).toEqual([{ value: 1 }]);
  });

  it('binds parameters as a mutable array', async () => {
    const query = vi.fn().mockResolvedValue([]);
    const scope = new TypeormTransactionScope({
      query,
    } as unknown as QueryRunner);

    await scope.run('SELECT $1', [5]);

    expect(query).toHaveBeenLastCalledWith('SELECT $1', [5]);
  });

  it('unwraps the [rows, affectedCount] tuple from UPDATE ... RETURNING', async () => {
    const query = vi.fn().mockResolvedValue([[{ id: 'a' }], 1]);
    const scope = new TypeormTransactionScope({
      query,
    } as unknown as QueryRunner);

    const rows = await scope.run('UPDATE t SET x = 1 RETURNING id');

    expect(rows).toEqual([{ id: 'a' }]);
  });

  it('unwraps an empty tuple from a zero-row UPDATE ... RETURNING', async () => {
    const query = vi.fn().mockResolvedValue([[], 0]);
    const scope = new TypeormTransactionScope({
      query,
    } as unknown as QueryRunner);

    const rows = await scope.run('UPDATE t SET x = 1 WHERE false RETURNING id');

    expect(rows).toEqual([]);
  });

  it('leaves a plain SELECT rows array untouched', async () => {
    const query = vi.fn().mockResolvedValue([{ id: 'a' }, { id: 'b' }]);
    const scope = new TypeormTransactionScope({
      query,
    } as unknown as QueryRunner);

    const rows = await scope.run('SELECT id FROM t');

    expect(rows).toEqual([{ id: 'a' }, { id: 'b' }]);
  });
});
