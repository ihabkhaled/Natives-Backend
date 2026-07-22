import type { QueryRunner } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';

import { JobHeartbeats1725200000000 } from './1725200000000-job-heartbeats';

function runner() {
  return { query: vi.fn().mockResolvedValue(undefined) };
}

describe('JobHeartbeats1725200000000', () => {
  it('creates the heartbeat table keyed by job with a constrained outcome', async () => {
    const queryRunner = runner();
    await new JobHeartbeats1725200000000().up(
      queryRunner as never as QueryRunner,
    );
    const statements = queryRunner.query.mock.calls
      .map(call => String(call[0]))
      .join('\n');
    expect(statements).toContain('CREATE TABLE "job_heartbeats"');
    expect(statements).toContain('"job_key" text PRIMARY KEY');
    expect(statements).toContain(
      `CHECK ("last_outcome" IN ('succeeded','failed'))`,
    );
    expect(statements).toContain('"failure_count" integer NOT NULL DEFAULT 0');
    expect(statements).toContain('"last_run_at" timestamptz NOT NULL');
  });

  it('reverses exactly what it created', async () => {
    const queryRunner = runner();
    await new JobHeartbeats1725200000000().down(
      queryRunner as never as QueryRunner,
    );
    expect(String(queryRunner.query.mock.calls[0]?.[0])).toContain(
      'DROP TABLE IF EXISTS "job_heartbeats"',
    );
  });
});
