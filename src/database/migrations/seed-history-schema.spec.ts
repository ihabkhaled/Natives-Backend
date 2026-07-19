import type { QueryRunner } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';

import { SeedHistorySchema1722600000000 } from './1722600000000-seed-history-schema';

function runner() {
  return { query: vi.fn().mockResolvedValue(undefined) };
}

describe('SeedHistorySchema1722600000000', () => {
  it('creates the seed_history ledger with a unique seed_key index', async () => {
    const queryRunner = runner();

    await new SeedHistorySchema1722600000000().up(
      queryRunner as never as QueryRunner,
    );

    const statements = queryRunner.query.mock.calls
      .map(call => String(call[0]))
      .join('\n');
    expect(statements).toContain('CREATE TABLE "seed_history"');
    expect(statements).toContain('"seed_key" text NOT NULL');
    expect(statements).toContain('"checksum" text NOT NULL');
    expect(statements).toContain(
      '"applied_at" timestamptz NOT NULL DEFAULT now()',
    );
    expect(statements).toContain('"applied_by" text NOT NULL');
    expect(statements).toContain('"ux_seed_history_seed_key"');
  });

  it('drops the seed_history table on down', async () => {
    const queryRunner = runner();

    await new SeedHistorySchema1722600000000().down(
      queryRunner as never as QueryRunner,
    );

    expect(queryRunner.query).toHaveBeenCalledWith(
      expect.stringContaining('DROP TABLE IF EXISTS "seed_history"'),
    );
  });
});
