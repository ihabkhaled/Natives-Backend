import type { QueryRunner } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';

import { AchievementRejectionReason1725500000000 } from './1725500000000-achievement-rejection-reason';

function runner() {
  return { query: vi.fn().mockResolvedValue(undefined) };
}

function statementsOf(queryRunner: ReturnType<typeof runner>): string {
  return queryRunner.query.mock.calls.map(call => String(call[0])).join('\n');
}

describe('AchievementRejectionReason1725500000000', () => {
  it('adds the nullable rejection_reason column idempotently', async () => {
    const queryRunner = runner();
    await new AchievementRejectionReason1725500000000().up(
      queryRunner as never as QueryRunner,
    );
    const statements = statementsOf(queryRunner);
    expect(statements).toContain('ALTER TABLE "team_achievements"');
    expect(statements).toContain(
      'ADD COLUMN IF NOT EXISTS "rejection_reason" text',
    );
    expect(statements).not.toContain('NOT NULL');
  });

  it('drops exactly that column on down', async () => {
    const queryRunner = runner();
    await new AchievementRejectionReason1725500000000().down(
      queryRunner as never as QueryRunner,
    );
    expect(statementsOf(queryRunner)).toContain(
      'DROP COLUMN IF EXISTS "rejection_reason"',
    );
  });
});
