import type { QueryRunner } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';

import { LeaderboardIndexes1723200000000 } from './1723200000000-leaderboard-indexes';

function runner() {
  return { query: vi.fn().mockResolvedValue(undefined) };
}

describe('LeaderboardIndexes1723200000000', () => {
  it('creates a covering index for windowed leaderboard aggregation', async () => {
    const queryRunner = runner();
    await new LeaderboardIndexes1723200000000().up(
      queryRunner as never as QueryRunner,
    );
    const statements = queryRunner.query.mock.calls
      .map(call => String(call[0]))
      .join('\n');
    expect(statements).toContain('"ix_points_ledger_team_created"');
    expect(statements).toContain('"team_id", "created_at"');
    expect(statements).toContain(
      'INCLUDE ("membership_id", "activity_category", "amount")',
    );
  });

  it('reverses exactly what it created', async () => {
    const queryRunner = runner();
    await new LeaderboardIndexes1723200000000().down(
      queryRunner as never as QueryRunner,
    );
    expect(queryRunner.query.mock.calls.map(call => call[0])).toEqual([
      'DROP INDEX IF EXISTS "ix_points_ledger_team_created"',
    ]);
  });
});
