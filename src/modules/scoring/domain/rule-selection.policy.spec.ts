import { describe, expect, it } from 'vitest';

import { CalculationRuleStatus } from '../model/scoring.enums';
import type { CalculationRule } from '../model/scoring.types';
import { selectEffectiveRule } from './rule-selection.policy';

function rule(overrides: Partial<CalculationRule> = {}): CalculationRule {
  return {
    ruleId: 'rule-1',
    teamId: 'team-1',
    seasonId: null,
    ruleKey: 'legacy_overall',
    version: 1,
    name: 'Legacy overall',
    description: null,
    status: CalculationRuleStatus.Published,
    scaleMin: 0,
    scaleMax: 5,
    minComponents: 1,
    components: [],
    effectiveFrom: null,
    effectiveTo: null,
    recordVersion: 1,
    createdBy: null,
    publishedBy: null,
    publishedAt: null,
    retiredAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('selectEffectiveRule', () => {
  it('returns null when nothing is published', () => {
    expect(
      selectEffectiveRule(
        [rule({ status: CalculationRuleStatus.Draft })],
        '2026-06-01',
      ),
    ).toBeNull();
    expect(selectEffectiveRule([], '2026-06-01')).toBeNull();
  });

  it('picks the highest published version within its window', () => {
    const selected = selectEffectiveRule(
      [
        rule({ ruleId: 'v1', version: 1 }),
        rule({ ruleId: 'v2', version: 2 }),
        rule({
          ruleId: 'draft',
          version: 3,
          status: CalculationRuleStatus.Draft,
        }),
      ],
      '2026-06-01',
    );
    expect(selected?.ruleId).toBe('v2');
  });

  it('honours an effective-from bound', () => {
    expect(
      selectEffectiveRule(
        [rule({ effectiveFrom: '2026-07-01' })],
        '2026-06-01',
      ),
    ).toBeNull();
    expect(
      selectEffectiveRule([rule({ effectiveFrom: '2026-01-01' })], '2026-06-01')
        ?.ruleId,
    ).toBe('rule-1');
  });

  it('honours an effective-to bound', () => {
    expect(
      selectEffectiveRule([rule({ effectiveTo: '2026-05-01' })], '2026-06-01'),
    ).toBeNull();
    expect(
      selectEffectiveRule([rule({ effectiveTo: '2026-12-31' })], '2026-06-01')
        ?.ruleId,
    ).toBe('rule-1');
  });
});
