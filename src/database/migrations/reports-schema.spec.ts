import type { QueryRunner } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';

import { ReportsSchema1724500000000 } from './1724500000000-reports-schema';

function runner(): { query: ReturnType<typeof vi.fn> } {
  return { query: vi.fn().mockResolvedValue(undefined) };
}

async function upStatements(): Promise<string> {
  const queryRunner = runner();
  await new ReportsSchema1724500000000().up(
    queryRunner as never as QueryRunner,
  );
  return queryRunner.query.mock.calls.map(call => String(call[0])).join('\n');
}

describe('ReportsSchema1724500000000', () => {
  it('creates the report jobs table', async () => {
    const statements = await upStatements();
    expect(statements).toContain('"report_jobs"');
    expect(statements).toContain('"ux_report_request"');
  });

  it('constrains the terminal job lifecycle and formats', async () => {
    const statements = await upStatements();
    for (const status of [
      'queued',
      'running',
      'completed',
      'failed',
      'expired',
    ]) {
      expect(statements).toContain(`'${status}'`);
    }
    for (const format of ['csv', 'xlsx', 'pdf']) {
      expect(statements).toContain(`'${format}'`);
    }
  });

  it('stores a checksum and expiry, never the artifact bytes', async () => {
    const statements = await upStatements();
    expect(statements).toContain('"checksum"');
    expect(statements).toContain('"expires_at"');
    expect(statements).not.toMatch(/artifact_bytes|content bytea/u);
  });

  it('drops the table on down', async () => {
    const queryRunner = runner();
    await new ReportsSchema1724500000000().down(
      queryRunner as never as QueryRunner,
    );
    expect(String(queryRunner.query.mock.calls[0]?.[0])).toContain(
      'DROP TABLE IF EXISTS "report_jobs"',
    );
  });
});
