import { describe, expect, it } from 'vitest';

import { ScoreCategory } from '../model/scoring.enums';
import type { RuleContentInput } from '../model/scoring.types';
import { toRuleContent } from './scoring-command.mapper';

describe('toRuleContent', () => {
  it('applies legacy defaults for omitted scale, floor, and sample', () => {
    const input: RuleContentInput = {
      ruleKey: 'legacy_overall',
      name: 'Legacy overall',
      components: [{ categoryKey: ScoreCategory.Training, weight: 1 }],
    };
    expect(toRuleContent(input)).toEqual({
      ruleKey: 'legacy_overall',
      name: 'Legacy overall',
      description: null,
      seasonId: null,
      scaleMin: 0,
      scaleMax: 5,
      minComponents: 1,
      effectiveFrom: null,
      effectiveTo: null,
      components: [
        { categoryKey: ScoreCategory.Training, weight: 1, minSample: 0 },
      ],
    });
  });

  it('preserves explicitly provided values', () => {
    const input: RuleContentInput = {
      ruleKey: 'custom',
      name: 'Custom',
      description: 'A tuned rule',
      seasonId: 'season-1',
      scaleMin: 1,
      scaleMax: 10,
      minComponents: 2,
      effectiveFrom: '2026-01-01',
      effectiveTo: '2026-12-31',
      components: [
        { categoryKey: ScoreCategory.Physical, weight: 2, minSample: 3 },
      ],
    };
    const content = toRuleContent(input);
    expect(content.scaleMin).toBe(1);
    expect(content.scaleMax).toBe(10);
    expect(content.minComponents).toBe(2);
    expect(content.description).toBe('A tuned rule');
    expect(content.components[0]?.minSample).toBe(3);
  });
});
