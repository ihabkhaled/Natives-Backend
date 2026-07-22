import type { QueryRunner } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';

import { TryoutsSchema1724100000000 } from './1724100000000-tryouts-schema';

function runner(): { query: ReturnType<typeof vi.fn> } {
  return { query: vi.fn().mockResolvedValue(undefined) };
}

async function upStatements(): Promise<string> {
  const queryRunner = runner();
  await new TryoutsSchema1724100000000().up(
    queryRunner as never as QueryRunner,
  );
  return queryRunner.query.mock.calls.map(call => String(call[0])).join('\n');
}

describe('TryoutsSchema1724100000000', () => {
  it('creates the five additive tables', async () => {
    const statements = await upStatements();
    expect(statements).toContain('"tryout_events"');
    expect(statements).toContain('"tryout_candidates"');
    expect(statements).toContain('"tryout_evaluations"');
    expect(statements).toContain('"tryout_decisions"');
    expect(statements).toContain('"tryout_offers"');
  });

  it('never adds a national id column to a candidate', async () => {
    const statements = await upStatements();
    expect(statements).not.toMatch(/national_id|nationalId/u);
  });

  it('keeps an unlimited capacity nullable rather than zero', async () => {
    const statements = await upStatements();
    expect(statements).toContain('"capacity" IS NULL OR "capacity" > 0');
  });

  it('deduplicates a registrant by a one-way identity fingerprint', async () => {
    const statements = await upStatements();
    expect(statements).toContain('"ux_candidates_event_identity"');
    expect(statements).toContain('"identity_hash"');
  });

  it('keeps decisions append-only and at most one live offer', async () => {
    const statements = await upStatements();
    expect(statements).toContain('"rl_tryout_decisions_immutable"');
    expect(statements).toContain('"ux_offers_live_candidate"');
  });

  it('drops every table on down in dependency order', async () => {
    const queryRunner = runner();
    await new TryoutsSchema1724100000000().down(
      queryRunner as never as QueryRunner,
    );
    const statements = queryRunner.query.mock.calls
      .map(call => String(call[0]))
      .join('\n');
    expect(statements).toContain('DROP TABLE IF EXISTS "tryout_offers"');
    expect(statements).toContain('DROP TABLE IF EXISTS "tryout_events"');
  });
});
