import type { QueryRunner } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';

import { MigrationSchema1724600000000 } from './1724600000000-migration-schema';

function runner(): { query: ReturnType<typeof vi.fn> } {
  return { query: vi.fn().mockResolvedValue(undefined) };
}

async function upStatements(): Promise<string> {
  const queryRunner = runner();
  await new MigrationSchema1724600000000().up(
    queryRunner as never as QueryRunner,
  );
  return queryRunner.query.mock.calls.map(call => String(call[0])).join('\n');
}

describe('MigrationSchema1724600000000', () => {
  it('creates the four additive tables', async () => {
    const statements = await upStatements();
    for (const table of [
      'import_jobs',
      'import_row_results',
      'alias_resolutions',
      'formula_comparisons',
    ]) {
      expect(statements).toContain(`"${table}"`);
    }
  });

  it('makes a committed source idempotent and never stores the file', async () => {
    const statements = await upStatements();
    expect(statements).toContain('"ux_import_source"');
    expect(statements).toContain('"source_hash"');
    expect(statements).not.toMatch(/source_bytes|workbook_bytes|file_content/u);
  });

  it('constrains the discrepancy classifications', async () => {
    const statements = await upStatements();
    for (const classification of [
      'matching',
      'target_bug',
      'legacy_defect',
      'broken_reference',
      'missing_vs_zero',
      'version_difference',
    ]) {
      expect(statements).toContain(`'${classification}'`);
    }
  });

  it('drops every table on down in dependency order', async () => {
    const queryRunner = runner();
    await new MigrationSchema1724600000000().down(
      queryRunner as never as QueryRunner,
    );
    const statements = queryRunner.query.mock.calls
      .map(call => String(call[0]))
      .join('\n');
    expect(statements).toContain('DROP TABLE IF EXISTS "formula_comparisons"');
    expect(statements).toContain('DROP TABLE IF EXISTS "import_jobs"');
  });
});
