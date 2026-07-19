import type { QueryRunner } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';

import { ActivityReviewSchema1723000000000 } from './1723000000000-activity-review-schema';

function runner() {
  return { query: vi.fn().mockResolvedValue(undefined) };
}

async function upStatements(): Promise<string> {
  const queryRunner = runner();
  await new ActivityReviewSchema1723000000000().up(
    queryRunner as never as QueryRunner,
  );
  return queryRunner.query.mock.calls.map(call => String(call[0])).join('\n');
}

describe('ActivityReviewSchema1723000000000', () => {
  it('adds the reviewer-workflow columns additively', async () => {
    const statements = await upStatements();
    expect(statements).toContain('ALTER TABLE "activity_submissions"');
    for (const column of [
      '"reviewer_user_id" uuid',
      '"review_started_at" timestamptz',
      '"reversal_reason" text',
      '"reversed_at" timestamptz',
      '"reversed_by" uuid',
    ]) {
      expect(statements).toContain(column);
    }
    expect(statements).toContain('ON DELETE SET NULL');
  });

  it('creates a bounded, partial review-queue index', async () => {
    const statements = await upStatements();
    expect(statements).toContain('"ix_activity_submissions_review_queue"');
    expect(statements).toContain(
      `"status" IN ('submitted', 'under_review', 'changes_requested')`,
    );
    expect(statements).toContain('"deleted_at" IS NULL');
  });

  it('reverses exactly what it created, index before columns', async () => {
    const queryRunner = runner();
    await new ActivityReviewSchema1723000000000().down(
      queryRunner as never as QueryRunner,
    );
    const statements = queryRunner.query.mock.calls.map(call =>
      String(call[0]),
    );
    expect(statements[0]).toContain(
      'DROP INDEX IF EXISTS "ix_activity_submissions_review_queue"',
    );
    expect(statements[1]).toContain('DROP COLUMN IF EXISTS "reversed_by"');
    expect(statements[1]).toContain('DROP COLUMN IF EXISTS "reviewer_user_id"');
  });
});
