import { describe, expect, it } from 'vitest';

import { PointsValidationError } from '../errors/points-validation.error';
import type { RuleContent } from '../model/points.types';
import { assertRuleContent } from './points-rule.policy';

function content(overrides: Partial<RuleContent> = {}): RuleContent {
  return {
    ruleKey: 'external_training',
    name: 'External training',
    description: null,
    seasonId: null,
    effectiveFrom: null,
    effectiveTo: null,
    pointEntries: [
      {
        activityCategory: 'gym',
        points: 2,
        dailyCap: null,
        cooldownDays: null,
      },
    ],
    ...overrides,
  };
}

describe('assertRuleContent', () => {
  it('accepts a non-empty, unique-category value set', () => {
    expect(() => assertRuleContent(content())).not.toThrow();
  });

  it('rejects an empty value set', () => {
    expect(() => assertRuleContent(content({ pointEntries: [] }))).toThrow(
      PointsValidationError,
    );
  });

  it('rejects a duplicated activity category', () => {
    const duplicated = content({
      pointEntries: [
        {
          activityCategory: 'gym',
          points: 2,
          dailyCap: null,
          cooldownDays: null,
        },
        {
          activityCategory: 'gym',
          points: 3,
          dailyCap: null,
          cooldownDays: null,
        },
      ],
    });
    expect(() => assertRuleContent(duplicated)).toThrow(PointsValidationError);
  });
});
