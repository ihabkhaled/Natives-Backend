import { describe, expect, it } from 'vitest';

import { ScoreCategory, ScoreConfidence } from '../model/scoring.enums';
import type {
  CategoryInput,
  RuleComponent,
  ScoreRuleDefinition,
} from '../model/scoring.types';
import {
  aggregateWeighted,
  computeCategoryScore,
  computePerformanceScore,
  deriveConfidence,
  isComponentPresent,
} from './performance-score.engine';

const LEGACY_CATEGORIES: readonly ScoreCategory[] = [
  ScoreCategory.Training,
  ScoreCategory.Technical,
  ScoreCategory.Tactical,
  ScoreCategory.Physical,
  ScoreCategory.Psychological,
  ScoreCategory.Behavioral,
  ScoreCategory.Attendance,
];

function component(
  categoryKey: ScoreCategory,
  overrides: Partial<RuleComponent> = {},
): RuleComponent {
  return { categoryKey, weight: 1, minSample: 1, ...overrides };
}

function rule(
  components: readonly RuleComponent[],
  overrides: Partial<ScoreRuleDefinition> = {},
): ScoreRuleDefinition {
  return {
    ruleId: 'rule-1',
    ruleKey: 'legacy_overall',
    version: 1,
    name: 'Legacy equal-weight overall',
    scaleMin: 0,
    scaleMax: 5,
    minComponents: 1,
    components,
    ...overrides,
  };
}

function input(
  categoryKey: ScoreCategory,
  value: number | null,
  assessedMetrics = 1,
  totalMetrics = 1,
): CategoryInput {
  return { categoryKey, value, assessedMetrics, totalMetrics };
}

const LEGACY_RULE = rule(LEGACY_CATEGORIES.map(key => component(key)));

describe('aggregateWeighted', () => {
  it('is the weighted mean over present components', () => {
    const result = aggregateWeighted([
      { key: 'a', value: 4, weight: 1 },
      { key: 'b', value: 2, weight: 3 },
    ]);
    expect(result.numerator).toBe(10);
    expect(result.denominator).toBe(4);
    expect(result.value).toBe(2.5);
    expect(result.includedKeys).toEqual(['a', 'b']);
    expect(result.excludedKeys).toEqual([]);
  });

  it('excludes null (missing) but includes a measured zero', () => {
    const result = aggregateWeighted([
      { key: 'zero', value: 0, weight: 1 },
      { key: 'missing', value: null, weight: 1 },
    ]);
    expect(result.value).toBe(0);
    expect(result.numerator).toBe(0);
    expect(result.denominator).toBe(1);
    expect(result.includedKeys).toEqual(['zero']);
    expect(result.excludedKeys).toEqual(['missing']);
  });

  it('excludes a non-positive weight and yields null with no denominator', () => {
    const result = aggregateWeighted([{ key: 'z', value: 5, weight: 0 }]);
    expect(result.value).toBeNull();
    expect(result.denominator).toBe(0);
    expect(result.excludedKeys).toEqual(['z']);
  });

  it('yields null (not zero) for an empty component set', () => {
    expect(aggregateWeighted([]).value).toBeNull();
  });
});

describe('computeCategoryScore', () => {
  it('averages assessed metrics, excluding nulls, including zeros', () => {
    const result = computeCategoryScore([4, 0, null, 2]);
    expect(result.numerator).toBe(6);
    expect(result.denominator).toBe(3);
    expect(result.value).toBe(2);
    expect(result.excludedKeys).toHaveLength(1);
  });

  it('is null when no metric was assessed', () => {
    expect(computeCategoryScore([null, null]).value).toBeNull();
    expect(computeCategoryScore([]).value).toBeNull();
  });
});

describe('deriveConfidence', () => {
  it('maps completeness and presence to a band', () => {
    expect(deriveConfidence(0, 0)).toBe(ScoreConfidence.None);
    expect(deriveConfidence(1, 3)).toBe(ScoreConfidence.High);
    expect(deriveConfidence(0.8, 3)).toBe(ScoreConfidence.High);
    expect(deriveConfidence(0.6, 3)).toBe(ScoreConfidence.Medium);
    expect(deriveConfidence(0.5, 3)).toBe(ScoreConfidence.Medium);
    expect(deriveConfidence(0.25, 1)).toBe(ScoreConfidence.Low);
  });
});

describe('isComponentPresent', () => {
  it('requires an input with a non-null value, positive weight, and sample', () => {
    const comp = component(ScoreCategory.Training);
    expect(isComponentPresent(comp, undefined)).toBe(false);
    expect(isComponentPresent(comp, input(ScoreCategory.Training, null))).toBe(
      false,
    );
    expect(
      isComponentPresent(
        component(ScoreCategory.Training, { weight: 0 }),
        input(ScoreCategory.Training, 4),
      ),
    ).toBe(false);
    expect(
      isComponentPresent(
        component(ScoreCategory.Training, { minSample: 3 }),
        input(ScoreCategory.Training, 4, 2, 5),
      ),
    ).toBe(false);
    expect(isComponentPresent(comp, input(ScoreCategory.Training, 4))).toBe(
      true,
    );
  });
});

describe('computePerformanceScore (golden legacy)', () => {
  it('projects the equal-weight overall over six present categories', () => {
    const inputs: readonly CategoryInput[] = [
      input(ScoreCategory.Training, 4),
      input(ScoreCategory.Technical, 3),
      input(ScoreCategory.Tactical, 5),
      input(ScoreCategory.Physical, 2),
      input(ScoreCategory.Psychological, 4),
      input(ScoreCategory.Behavioral, 3),
      input(ScoreCategory.Attendance, null),
    ];
    const result = computePerformanceScore(LEGACY_RULE, inputs);
    expect(result.numerator).toBe(21);
    expect(result.denominator).toBe(6);
    expect(result.value).toBe(3.5);
    expect(result.includedCount).toBe(6);
    expect(result.excludedCount).toBe(1);
    expect(result.sufficient).toBe(true);
    expect(result.completeness).toBeCloseTo(6 / 7, 10);
    expect(result.confidence).toBe(ScoreConfidence.High);
  });

  it('keeps a measured zero in and a missing null out', () => {
    const twoRule = rule([
      component(ScoreCategory.Training),
      component(ScoreCategory.Technical),
    ]);
    const result = computePerformanceScore(twoRule, [
      input(ScoreCategory.Training, 0),
      input(ScoreCategory.Technical, null),
    ]);
    expect(result.value).toBe(0);
    expect(result.includedCount).toBe(1);
    expect(result.excludedCount).toBe(1);
    expect(result.completeness).toBe(0.5);
    expect(result.confidence).toBe(ScoreConfidence.Medium);
    const included = result.components.find(
      c => c.categoryKey === ScoreCategory.Training,
    );
    expect(included?.contribution).toBe(0);
    const excluded = result.components.find(
      c => c.categoryKey === ScoreCategory.Technical,
    );
    expect(excluded?.included).toBe(false);
    expect(excluded?.contribution).toBeNull();
  });

  it('withholds the overall (null) when fewer than the minimum are present', () => {
    const strict = rule(
      [
        component(ScoreCategory.Training),
        component(ScoreCategory.Technical),
        component(ScoreCategory.Tactical),
      ],
      { minComponents: 3 },
    );
    const result = computePerformanceScore(strict, [
      input(ScoreCategory.Training, 4),
      input(ScoreCategory.Technical, 2),
      input(ScoreCategory.Tactical, null),
    ]);
    expect(result.sufficient).toBe(false);
    expect(result.value).toBeNull();
    expect(result.numerator).toBe(6);
    expect(result.denominator).toBe(2);
  });

  it('is null with no data and reports zero confidence', () => {
    const result = computePerformanceScore(LEGACY_RULE, [
      input(ScoreCategory.Training, null),
    ]);
    expect(result.value).toBeNull();
    expect(result.includedCount).toBe(0);
    expect(result.confidence).toBe(ScoreConfidence.None);
    expect(result.completeness).toBe(0);
  });

  it('reports zero completeness for a rule with no components', () => {
    const empty = rule([], { minComponents: 1 });
    const result = computePerformanceScore(empty, []);
    expect(result.completeness).toBe(0);
    expect(result.components).toEqual([]);
    expect(result.value).toBeNull();
  });

  it('defaults missing coverage to zero when no input matches', () => {
    const result = computePerformanceScore(LEGACY_RULE, []);
    const training = result.components.find(
      c => c.categoryKey === ScoreCategory.Training,
    );
    expect(training?.assessedMetrics).toBe(0);
    expect(training?.totalMetrics).toBe(0);
    expect(training?.value).toBeNull();
  });
});
