import type { QueryRunner } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';

import { DataQualitySchema1724700000000 } from './1724700000000-data-quality-schema';

function runner(): { query: ReturnType<typeof vi.fn> } {
  return { query: vi.fn().mockResolvedValue(undefined) };
}

async function upStatements(): Promise<string> {
  const queryRunner = runner();
  await new DataQualitySchema1724700000000().up(
    queryRunner as never as QueryRunner,
  );
  return queryRunner.query.mock.calls.map(call => String(call[0])).join('\n');
}

describe('DataQualitySchema1724700000000', () => {
  it('creates the anomalies and repairs tables', async () => {
    const statements = await upStatements();
    expect(statements).toContain('"data_quality_anomalies"');
    expect(statements).toContain('"data_quality_repairs"');
    expect(statements).toContain('"ux_anomaly_fingerprint"');
  });

  it('constrains the rule set and repair lifecycle', async () => {
    const statements = await upStatements();
    for (const rule of [
      'duplicate_identity',
      'jersey_conflict',
      'orphan_points',
      'stale_projection',
    ]) {
      expect(statements).toContain(`'${rule}'`);
    }
    for (const status of ['previewed', 'applied', 'rolled_back', 'failed']) {
      expect(statements).toContain(`'${status}'`);
    }
  });

  it('keeps a rollback reference and a suppression window', async () => {
    const statements = await upStatements();
    expect(statements).toContain('"rollback_ref"');
    expect(statements).toContain('"suppressed_until"');
  });

  it('drops both tables on down in dependency order', async () => {
    const queryRunner = runner();
    await new DataQualitySchema1724700000000().down(
      queryRunner as never as QueryRunner,
    );
    const statements = queryRunner.query.mock.calls
      .map(call => String(call[0]))
      .join('\n');
    expect(statements).toContain('DROP TABLE IF EXISTS "data_quality_repairs"');
    expect(statements).toContain(
      'DROP TABLE IF EXISTS "data_quality_anomalies"',
    );
  });
});
