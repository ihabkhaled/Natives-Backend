import { describe, expect, it } from 'vitest';

import type {
  CalculationRuleRow,
  CategorySourceRow,
  ScoreProjectionRow,
} from '../model/scoring.rows';
import {
  parseComponents,
  toAttendanceCounts,
  toCalculationRule,
  toCategorySource,
  toScoreProjection,
} from './scoring.mapper';

function ruleRow(
  overrides: Partial<CalculationRuleRow> = {},
): CalculationRuleRow {
  return {
    id: 'rule-1',
    team_id: 'team-1',
    season_id: null,
    rule_key: 'legacy_overall',
    version: 1,
    name: 'Legacy overall',
    description: null,
    status: 'draft',
    scale_min: '0',
    scale_max: '5',
    min_components: 1,
    components: [{ categoryKey: 'training', weight: 1, minSample: 1 }],
    effective_from: null,
    effective_to: null,
    record_version: 1,
    created_by: 'admin-1',
    published_by: null,
    published_at: null,
    retired_at: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function projectionRow(
  overrides: Partial<ScoreProjectionRow> = {},
): ScoreProjectionRow {
  return {
    id: 'proj-1',
    team_id: 'team-1',
    season_id: null,
    membership_id: 'mem-1',
    period_id: null,
    rule_id: 'rule-1',
    rule_key: 'legacy_overall',
    rule_version: 1,
    status: 'ready',
    overall_value: '3.5',
    overall_numerator: '21',
    overall_denominator: '6',
    included_count: 6,
    excluded_count: 1,
    completeness: '0.857',
    confidence: 'high',
    explanation: { rule: { ruleId: 'rule-1' } },
    source_hash: 'abc',
    error: null,
    computed_at: '2026-01-02T00:00:00.000Z',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-02T00:00:00.000Z',
    ...overrides,
  };
}

describe('toCalculationRule', () => {
  it('maps a rule row and parses its components', () => {
    const rule = toCalculationRule(ruleRow());
    expect(rule.ruleId).toBe('rule-1');
    expect(rule.scaleMin).toBe(0);
    expect(rule.scaleMax).toBe(5);
    expect(rule.components).toEqual([
      { categoryKey: 'training', weight: 1, minSample: 1 },
    ]);
    expect(rule.publishedAt).toBeNull();
  });
});

describe('parseComponents', () => {
  it('maps an array and yields empty for a non-array', () => {
    expect(
      parseComponents([{ categoryKey: 'physical', weight: 2, minSample: 0 }]),
    ).toEqual([{ categoryKey: 'physical', weight: 2, minSample: 0 }]);
    expect(parseComponents(null)).toEqual([]);
    expect(parseComponents('nope')).toEqual([]);
  });
});

describe('toScoreProjection', () => {
  it('maps a projection row including its explanation', () => {
    const projection = toScoreProjection(projectionRow());
    expect(projection.value).toBe(3.5);
    expect(projection.numerator).toBe(21);
    expect(projection.completeness).toBeCloseTo(0.857, 3);
    expect(projection.explanation).not.toBeNull();
    expect(projection.computedAt).not.toBeNull();
  });

  it('preserves a null overall value and a null explanation', () => {
    const projection = toScoreProjection(
      projectionRow({
        overall_value: null,
        overall_numerator: null,
        overall_denominator: null,
        explanation: null,
        computed_at: null,
        status: 'stale',
        confidence: 'none',
      }),
    );
    expect(projection.value).toBeNull();
    expect(projection.numerator).toBeNull();
    expect(projection.explanation).toBeNull();
    expect(projection.computedAt).toBeNull();
  });
});

describe('toAttendanceCounts', () => {
  it('maps a raw attendance-tally row into typed counts', () => {
    const counts = toAttendanceCounts({
      membership_id: 'mem-1',
      attended: 5,
      absent: 2,
      excused: 1,
    });
    expect(counts).toEqual({
      membershipId: 'mem-1',
      attendedEligible: 5,
      absentCount: 2,
      excusedSessions: 1,
    });
  });
});

describe('toCategorySource', () => {
  it('maps string and numeric aggregate values to numbers', () => {
    const row: CategorySourceRow = {
      membership_id: 'mem-1',
      category_key: 'technical',
      values: ['4', 3, '0'],
      total_metrics: 4,
    };
    const mapped = toCategorySource(row);
    expect(mapped.membershipId).toBe('mem-1');
    expect(mapped.source.categoryKey).toBe('technical');
    expect(mapped.source.values).toEqual([4, 3, 0]);
    expect(mapped.source.totalMetrics).toBe(4);
  });
});
