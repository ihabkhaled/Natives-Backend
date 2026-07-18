import type { QueryRunner } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';

import { PlayerAssessmentSchema1722400000000 } from './1722400000000-player-assessment-schema';

function runner() {
  return { query: vi.fn().mockResolvedValue(undefined) };
}

describe('PlayerAssessmentSchema1722400000000', () => {
  it('creates the player assessment and metric-value tables with guards', async () => {
    const queryRunner = runner();
    await new PlayerAssessmentSchema1722400000000().up(
      queryRunner as never as QueryRunner,
    );
    const statements = queryRunner.query.mock.calls
      .map(call => String(call[0]))
      .join('\n');
    expect(statements).toContain('"player_assessments"');
    expect(statements).toContain('"player_assessment_metric_values"');
    expect(statements).toContain('"numeric_value" numeric');
    expect(statements).toContain('"ux_player_assessment_live"');
    expect(statements).toContain('WHERE "superseded_at" IS NULL');
    expect(statements).toContain('guard_published_player_assessment');
    expect(statements).toContain('are immutable');
  });

  it('constrains the status values to the workflow states', async () => {
    const queryRunner = runner();
    await new PlayerAssessmentSchema1722400000000().up(
      queryRunner as never as QueryRunner,
    );
    const statements = queryRunner.query.mock.calls
      .map(call => String(call[0]))
      .join('\n');
    for (const status of [
      'draft',
      'submitted',
      'in_review',
      'approved',
      'published',
      'revised',
    ]) {
      expect(statements).toContain(`'${status}'`);
    }
  });

  it('drops only this additive schema and its guard functions', async () => {
    const queryRunner = runner();
    await new PlayerAssessmentSchema1722400000000().down(
      queryRunner as never as QueryRunner,
    );
    expect(queryRunner.query.mock.calls.map(call => call[0])).toEqual([
      'DROP TABLE IF EXISTS "player_assessment_metric_values"',
      'DROP TABLE IF EXISTS "player_assessments"',
      'DROP FUNCTION IF EXISTS "guard_published_player_assessment_value"()',
      'DROP FUNCTION IF EXISTS "guard_published_player_assessment"()',
    ]);
  });
});
