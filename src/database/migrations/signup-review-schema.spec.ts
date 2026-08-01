import type { QueryRunner } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';

import { SignupReview1725600000000 } from './1725600000000-signup-review';

function runner() {
  return { query: vi.fn().mockResolvedValue(undefined) };
}

describe('SignupReview1725600000000', () => {
  it('adds nullable signup review-tracking columns to users', async () => {
    const queryRunner = runner();
    await new SignupReview1725600000000().up(
      queryRunner as never as QueryRunner,
    );
    const statements = queryRunner.query.mock.calls
      .map(call => String(call[0]))
      .join('\n');
    expect(statements).toContain('ADD COLUMN "signup_reviewed_by" uuid');
    expect(statements).toContain('ON DELETE SET NULL');
    expect(statements).toContain('ADD COLUMN "signup_reviewed_at" timestamptz');
  });

  it('reverses exactly what it created', async () => {
    const queryRunner = runner();
    await new SignupReview1725600000000().down(
      queryRunner as never as QueryRunner,
    );
    const statements = queryRunner.query.mock.calls.map(call =>
      String(call[0]),
    );
    expect(statements[0]).toContain(
      'DROP COLUMN IF EXISTS "signup_reviewed_at"',
    );
    expect(statements[1]).toContain(
      'DROP COLUMN IF EXISTS "signup_reviewed_by"',
    );
  });
});
