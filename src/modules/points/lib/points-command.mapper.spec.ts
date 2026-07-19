import { describe, expect, it } from 'vitest';

import type { RuleContentInput } from '../model/points.types';
import { toRuleContent } from './points-command.mapper';

describe('toRuleContent', () => {
  it('fills absent optional fields with explicit nulls', () => {
    const input: RuleContentInput = {
      ruleKey: 'external_training',
      name: 'External training',
      pointEntries: [{ activityCategory: 'gym' }],
    };
    expect(toRuleContent(input)).toEqual({
      ruleKey: 'external_training',
      name: 'External training',
      description: null,
      seasonId: null,
      effectiveFrom: null,
      effectiveTo: null,
      pointEntries: [
        {
          activityCategory: 'gym',
          points: null,
          dailyCap: null,
          cooldownDays: null,
        },
      ],
    });
  });

  it('preserves provided values including a zero point value', () => {
    const input: RuleContentInput = {
      ruleKey: 'k',
      name: 'n',
      description: 'd',
      seasonId: 's',
      effectiveFrom: '2026-01-01',
      effectiveTo: '2026-12-31',
      pointEntries: [
        {
          activityCategory: 'gym',
          points: 0,
          dailyCap: 2,
          cooldownDays: 1,
        },
      ],
    };
    const content = toRuleContent(input);
    expect(content.pointEntries[0]).toEqual({
      activityCategory: 'gym',
      points: 0,
      dailyCap: 2,
      cooldownDays: 1,
    });
    expect(content.effectiveTo).toBe('2026-12-31');
  });
});
