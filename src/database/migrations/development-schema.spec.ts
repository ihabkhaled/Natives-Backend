import type { QueryRunner } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';

import { DevelopmentSchema1722500000000 } from './1722500000000-development-schema';

function runner() {
  return { query: vi.fn().mockResolvedValue(undefined) };
}

describe('DevelopmentSchema1722500000000', () => {
  it('creates the feedback, acknowledgement, goal, and action tables with a guard', async () => {
    const queryRunner = runner();
    await new DevelopmentSchema1722500000000().up(
      queryRunner as never as QueryRunner,
    );
    const statements = queryRunner.query.mock.calls
      .map(call => String(call[0]))
      .join('\n');
    expect(statements).toContain('"coach_feedback"');
    expect(statements).toContain('"feedback_acknowledgements"');
    expect(statements).toContain('"development_goals"');
    expect(statements).toContain('"development_goal_actions"');
    expect(statements).toContain('"coach_note" text');
    expect(statements).toContain('"target_value" numeric');
    expect(statements).toContain('"ux_coach_feedback_family_live"');
    expect(statements).toContain('WHERE "superseded_at" IS NULL');
    expect(statements).toContain('"ux_development_goal_metric_open"');
    expect(statements).toContain('guard_published_coach_feedback');
    expect(statements).toContain('is immutable');
  });

  it('constrains feedback and goal status values', async () => {
    const queryRunner = runner();
    await new DevelopmentSchema1722500000000().up(
      queryRunner as never as QueryRunner,
    );
    const statements = queryRunner.query.mock.calls
      .map(call => String(call[0]))
      .join('\n');
    for (const status of ['draft', 'in_review', 'published', 'revised']) {
      expect(statements).toContain(`'${status}'`);
    }
    for (const status of [
      'proposed',
      'active',
      'achieved',
      'missed',
      'cancelled',
    ]) {
      expect(statements).toContain(`'${status}'`);
    }
  });

  it('drops only this additive schema and its guard function', async () => {
    const queryRunner = runner();
    await new DevelopmentSchema1722500000000().down(
      queryRunner as never as QueryRunner,
    );
    expect(queryRunner.query.mock.calls.map(call => call[0])).toEqual([
      'DROP TABLE IF EXISTS "development_goal_actions"',
      'DROP TABLE IF EXISTS "development_goals"',
      'DROP TABLE IF EXISTS "feedback_acknowledgements"',
      'DROP TABLE IF EXISTS "coach_feedback"',
      'DROP FUNCTION IF EXISTS "guard_published_coach_feedback"()',
    ]);
  });
});
