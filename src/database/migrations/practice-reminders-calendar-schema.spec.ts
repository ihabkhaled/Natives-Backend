import type { QueryRunner } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';

import { PracticeRemindersCalendarSchema1722200000000 } from './1722200000000-practice-reminders-calendar-schema';

function runner() {
  return { query: vi.fn().mockResolvedValue(undefined) };
}

describe('PracticeRemindersCalendarSchema1722200000000', () => {
  it('creates digest-only feed credentials, bounds, and quiet hours', async () => {
    const queryRunner = runner();
    const migration = new PracticeRemindersCalendarSchema1722200000000();
    await migration.up(queryRunner as never as QueryRunner);
    const statements = queryRunner.query.mock.calls
      .map(call => String(call[0]))
      .join('\n');
    expect(statements).toContain('"token_digest" char(64) NOT NULL UNIQUE');
    expect(statements).not.toContain('"token" text');
    expect(statements).toContain('"expires_at" timestamptz NOT NULL');
    expect(statements).toContain('"notification_quiet_hours"');
    expect(statements).toContain('"urgent_cancellation_override"');
  });

  it('drops only the two additive tables in dependency-safe order', async () => {
    const queryRunner = runner();
    const migration = new PracticeRemindersCalendarSchema1722200000000();
    await migration.down(queryRunner as never as QueryRunner);
    expect(queryRunner.query.mock.calls.map(call => call[0])).toEqual([
      'DROP TABLE IF EXISTS "notification_quiet_hours"',
      'DROP TABLE IF EXISTS "practice_calendar_feed_tokens"',
    ]);
  });
});
