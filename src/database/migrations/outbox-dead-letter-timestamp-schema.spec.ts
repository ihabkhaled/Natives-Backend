import type { QueryRunner } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';

import { OutboxDeadLetterTimestamp1725300000000 } from './1725300000000-outbox-dead-letter-timestamp';

function runner() {
  return { query: vi.fn().mockResolvedValue(undefined) };
}

describe('OutboxDeadLetterTimestamp1725300000000', () => {
  it('adds the nullable timestamp and backfills existing dead letters', async () => {
    const queryRunner = runner();
    await new OutboxDeadLetterTimestamp1725300000000().up(
      queryRunner as never as QueryRunner,
    );
    const statements = queryRunner.query.mock.calls
      .map(call => String(call[0]))
      .join('\n');
    expect(statements).toContain('ADD COLUMN "dead_lettered_at" timestamptz');
    expect(statements).toContain(`SET "dead_lettered_at" = "occurred_at"`);
    expect(statements).toContain(`WHERE "status" = 'dead_lettered'`);
    expect(statements).toContain('"ix_outbox_events_dead_lettered"');
  });

  it('reverses exactly what it created', async () => {
    const queryRunner = runner();
    await new OutboxDeadLetterTimestamp1725300000000().down(
      queryRunner as never as QueryRunner,
    );
    const statements = queryRunner.query.mock.calls.map(call =>
      String(call[0]),
    );
    expect(statements[0]).toContain(
      'DROP INDEX IF EXISTS "ix_outbox_events_dead_lettered"',
    );
    expect(statements[1]).toContain('DROP COLUMN IF EXISTS "dead_lettered_at"');
  });
});
