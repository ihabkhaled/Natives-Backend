import type { QueryRunner } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';

import { AnalyticsSchema1724400000000 } from './1724400000000-analytics-schema';

function runner(): { query: ReturnType<typeof vi.fn> } {
  return { query: vi.fn().mockResolvedValue(undefined) };
}

async function upStatements(): Promise<string> {
  const queryRunner = runner();
  await new AnalyticsSchema1724400000000().up(
    queryRunner as never as QueryRunner,
  );
  return queryRunner.query.mock.calls.map(call => String(call[0])).join('\n');
}

describe('AnalyticsSchema1724400000000', () => {
  it('creates the projections read model', async () => {
    const statements = await upStatements();
    expect(statements).toContain('"analytics_projections"');
    expect(statements).toContain('"ux_projection_key"');
  });

  it('keeps the value nullable so a gap is not a false zero', async () => {
    const statements = await upStatements();
    expect(statements).toContain('"value" numeric,');
    expect(statements).toContain('"sample_size"');
    expect(statements).toContain('"calculation_version"');
  });

  it('drops the table on down', async () => {
    const queryRunner = runner();
    await new AnalyticsSchema1724400000000().down(
      queryRunner as never as QueryRunner,
    );
    expect(String(queryRunner.query.mock.calls[0]?.[0])).toContain(
      'DROP TABLE IF EXISTS "analytics_projections"',
    );
  });
});
