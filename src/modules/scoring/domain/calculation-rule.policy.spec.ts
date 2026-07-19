import { describe, expect, it } from 'vitest';

import { ScoringValidationError } from '../errors/scoring-validation.error';
import { ScoreCategory } from '../model/scoring.enums';
import type { RuleComponent, RuleContent } from '../model/scoring.types';
import { assertRuleContent } from './calculation-rule.policy';

function component(
  categoryKey: ScoreCategory,
  overrides: Partial<RuleComponent> = {},
): RuleComponent {
  return { categoryKey, weight: 1, minSample: 1, ...overrides };
}

function content(overrides: Partial<RuleContent> = {}): RuleContent {
  return {
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
      component(ScoreCategory.Training),
      component(ScoreCategory.Technical),
    ],
    ...overrides,
  };
}

describe('assertRuleContent', () => {
  it('accepts a valid rule definition', () => {
    expect(() => assertRuleContent(content())).not.toThrow();
    expect(() =>
      assertRuleContent(
        content({ effectiveFrom: '2026-01-01', effectiveTo: '2026-12-31' }),
      ),
    ).not.toThrow();
  });

  it('rejects a blank name', () => {
    expect(() => assertRuleContent(content({ name: ' ' }))).toThrow(
      ScoringValidationError,
    );
  });

  it('rejects a non-finite or inverted scale', () => {
    expect(() =>
      assertRuleContent(content({ scaleMin: Number.NaN })),
    ).toThrow(ScoringValidationError);
    expect(() => assertRuleContent(content({ scaleMin: 5, scaleMax: 5 }))).toThrow(
      ScoringValidationError,
    );
    expect(() =>
      assertRuleContent(content({ scaleMin: -1 })),
    ).toThrow(ScoringValidationError);
    expect(() =>
      assertRuleContent(content({ scaleMax: 100_000 })),
    ).toThrow(ScoringValidationError);
  });

  it('rejects an empty or over-large component set', () => {
    expect(() => assertRuleContent(content({ components: [] }))).toThrow(
      ScoringValidationError,
    );
  });

  it('rejects a duplicate category', () => {
    expect(() =>
      assertRuleContent(
        content({
          components: [
            component(ScoreCategory.Training),
            component(ScoreCategory.Training),
          ],
        }),
      ),
    ).toThrow(ScoringValidationError);
  });

  it('rejects an out-of-range weight or minimum sample', () => {
    expect(() =>
      assertRuleContent(
        content({ components: [component(ScoreCategory.Training, { weight: 0 })] }),
      ),
    ).toThrow(ScoringValidationError);
    expect(() =>
      assertRuleContent(
        content({
          components: [
            component(ScoreCategory.Training, { weight: Number.POSITIVE_INFINITY }),
          ],
        }),
      ),
    ).toThrow(ScoringValidationError);
    expect(() =>
      assertRuleContent(
        content({
          components: [component(ScoreCategory.Training, { minSample: -1 })],
        }),
      ),
    ).toThrow(ScoringValidationError);
    expect(() =>
      assertRuleContent(
        content({
          components: [component(ScoreCategory.Training, { minSample: 1.5 })],
        }),
      ),
    ).toThrow(ScoringValidationError);
  });

  it('rejects a minimum-components floor outside [1, count]', () => {
    expect(() => assertRuleContent(content({ minComponents: 0 }))).toThrow(
      ScoringValidationError,
    );
    expect(() => assertRuleContent(content({ minComponents: 3 }))).toThrow(
      ScoringValidationError,
    );
    expect(() =>
      assertRuleContent(content({ minComponents: 1.5 })),
    ).toThrow(ScoringValidationError);
  });

  it('rejects an inverted effective window', () => {
    expect(() =>
      assertRuleContent(
        content({ effectiveFrom: '2026-12-31', effectiveTo: '2026-01-01' }),
      ),
    ).toThrow(ScoringValidationError);
  });
});
