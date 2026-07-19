import type { QueryRunner } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';

import { ScoringSchema1722700000000 } from './1722700000000-scoring-schema';

function runner() {
  return { query: vi.fn().mockResolvedValue(undefined) };
}

describe('ScoringSchema1722700000000', () => {
  it('creates the rule and projection tables and seeds the legacy candidate', async () => {
    const queryRunner = runner();
    await new ScoringSchema1722700000000().up(
      queryRunner as never as QueryRunner,
    );
    const statements = queryRunner.query.mock.calls
      .map(call => String(call[0]))
      .join('\n');
    expect(statements).toContain('"calculation_rules"');
    expect(statements).toContain('"performance_score_projections"');
    expect(statements).toContain('"components" jsonb');
    expect(statements).toContain('"ux_calculation_rule_published"');
    expect(statements).toContain('WHERE "status" = \'published\'');
    expect(statements).toContain('"ux_score_projection_member_rule"');
    expect(statements).toContain("'legacy_overall'");
    expect(statements).toContain("'draft'");
    expect(statements).toContain('"attendance"');
  });

  it('constrains rule and projection status values', async () => {
    const queryRunner = runner();
    await new ScoringSchema1722700000000().up(
      queryRunner as never as QueryRunner,
    );
    const statements = queryRunner.query.mock.calls
      .map(call => String(call[0]))
      .join('\n');
    for (const status of ['draft', 'approved', 'published', 'retired']) {
      expect(statements).toContain(`'${status}'`);
    }
    for (const status of ['stale', 'building', 'ready', 'failed']) {
      expect(statements).toContain(`'${status}'`);
    }
  });

  it('drops only this additive schema in dependency order', async () => {
    const queryRunner = runner();
    await new ScoringSchema1722700000000().down(
      queryRunner as never as QueryRunner,
    );
    expect(queryRunner.query.mock.calls.map(call => call[0])).toEqual([
      'DROP TABLE IF EXISTS "performance_score_projections"',
      'DROP TABLE IF EXISTS "calculation_rules"',
    ]);
  });
});
