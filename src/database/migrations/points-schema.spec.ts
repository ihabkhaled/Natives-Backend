import type { QueryRunner } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';

import { PointsSchema1723100000000 } from './1723100000000-points-schema';

function runner() {
  return { query: vi.fn().mockResolvedValue(undefined) };
}

async function upStatements(): Promise<string> {
  const queryRunner = runner();
  await new PointsSchema1723100000000().up(queryRunner as never as QueryRunner);
  return queryRunner.query.mock.calls.map(call => String(call[0])).join('\n');
}

describe('PointsSchema1723100000000', () => {
  it('creates the four additive tables', async () => {
    const statements = await upStatements();
    expect(statements).toContain('"points_rules"');
    expect(statements).toContain('"points_ledger"');
    expect(statements).toContain('"badge_definitions"');
    expect(statements).toContain('"player_badges"');
    expect(statements).toContain('"point_entries" jsonb');
  });

  it('enforces one published rule per team and rule key', async () => {
    const statements = await upStatements();
    expect(statements).toContain('"ux_points_rule_published"');
    expect(statements).toContain(`WHERE "status" = 'published'`);
  });

  it('guards the ledger as append-only via a trigger', async () => {
    const statements = await upStatements();
    expect(statements).toContain('"guard_points_ledger_append_only"');
    expect(statements).toContain('BEFORE UPDATE OR DELETE ON "points_ledger"');
    expect(statements).toContain('RAISE EXCEPTION');
    expect(statements).toContain('"ux_points_ledger_idempotency"');
  });

  it('constrains ledger entry and source types', async () => {
    const statements = await upStatements();
    for (const type of [
      'award',
      'reversal',
      'manual_adjustment',
      'import_adjustment',
      'expiry',
    ]) {
      expect(statements).toContain(`'${type}'`);
    }
    for (const source of [
      'activity_submission',
      'manual',
      'import',
      'system',
    ]) {
      expect(statements).toContain(`'${source}'`);
    }
  });

  it('seeds the legacy values as a DRAFT candidate rule', async () => {
    const statements = await upStatements();
    expect(statements).toContain("'external_training'");
    expect(statements).toContain("'draft'");
    expect(statements).toContain('ON CONFLICT DO NOTHING');
  });

  it('seeds the badge tier candidates and the disabled broken tier', async () => {
    const queryRunner = runner();
    await new PointsSchema1723100000000().up(
      queryRunner as never as QueryRunner,
    );
    const params = queryRunner.query.mock.calls.flatMap(call =>
      Array.isArray(call[1]) ? (call[1] as unknown[]) : [],
    );
    expect(params).toContain(100);
    expect(params).toContain(200);
    expect(params).toContain(450);
    expect(params).toContain(649);
    expect(params).toContain('needs_approval');
    expect(params).toContain('disabled');
  });

  it('reverses exactly what it created, in dependency order', async () => {
    const queryRunner = runner();
    await new PointsSchema1723100000000().down(
      queryRunner as never as QueryRunner,
    );
    expect(queryRunner.query.mock.calls.map(call => call[0])).toEqual([
      'DROP TABLE IF EXISTS "player_badges"',
      'DROP TABLE IF EXISTS "badge_definitions"',
      'DROP TABLE IF EXISTS "points_ledger"',
      'DROP TABLE IF EXISTS "points_rules"',
      'DROP FUNCTION IF EXISTS "guard_points_ledger_append_only"()',
    ]);
  });
});
