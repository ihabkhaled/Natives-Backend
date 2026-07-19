import { describe, expect, it } from 'vitest';

import {
  EXCLUDED_MISSING_REASON,
  EXCLUDED_ZERO_WEIGHT_REASON,
  INSUFFICIENT_DATA_REASON,
} from '../model/scoring.constants';
import { ScoreCategory, ScoreConfidence } from '../model/scoring.enums';
import type {
  ComponentScore,
  PerformanceScoreResult,
  ScoreRuleDefinition,
} from '../model/scoring.types';
import { buildScoreExplanation } from './score-explanation.builder';

const RULE: ScoreRuleDefinition = {
  ruleId: 'rule-1',
  ruleKey: 'legacy_overall',
  version: 3,
  name: 'Legacy overall',
  scaleMin: 0,
  scaleMax: 5,
  minComponents: 1,
  components: [],
};

function component(overrides: Partial<ComponentScore>): ComponentScore {
  return {
    categoryKey: ScoreCategory.Training,
    weight: 1,
    value: 4,
    contribution: 4,
    included: true,
    assessedMetrics: 1,
    totalMetrics: 1,
    ...overrides,
  };
}

function result(
  components: readonly ComponentScore[],
  value: number | null,
): PerformanceScoreResult {
  return {
    value,
    numerator: 4,
    denominator: 1,
    includedCount: 1,
    excludedCount: components.length - 1,
    sufficient: value !== null,
    completeness: 0.5,
    confidence: ScoreConfidence.Medium,
    components,
  };
}

describe('buildScoreExplanation', () => {
  it('carries the rule version, arithmetic, and unrounded + display value', () => {
    const explanation = buildScoreExplanation(
      RULE,
      result([component({ value: 3.14159 })], 3.14159),
    );
    expect(explanation.rule).toEqual({
      ruleId: 'rule-1',
      ruleKey: 'legacy_overall',
      version: 3,
      name: 'Legacy overall',
    });
    expect(explanation.formulaVersion).toBe(3);
    expect(explanation.overall.unrounded).toBe(3.14159);
    expect(explanation.overall.display).toBe(3.14);
    expect(explanation.overall.numerator).toBe(4);
    expect(explanation.overall.sufficient).toBe(true);
    expect(explanation.confidence).toBe(ScoreConfidence.Medium);
  });

  it('keeps a null overall null and names each exclusion reason', () => {
    const explanation = buildScoreExplanation(
      RULE,
      result(
        [
          component({ categoryKey: ScoreCategory.Training }),
          component({
            categoryKey: ScoreCategory.Technical,
            weight: 0,
            value: null,
            contribution: null,
            included: false,
          }),
          component({
            categoryKey: ScoreCategory.Tactical,
            value: null,
            contribution: null,
            included: false,
            assessedMetrics: 2,
            totalMetrics: 5,
          }),
          component({
            categoryKey: ScoreCategory.Physical,
            value: null,
            contribution: null,
            included: false,
            assessedMetrics: 0,
            totalMetrics: 3,
          }),
        ],
        null,
      ),
    );
    expect(explanation.overall.unrounded).toBeNull();
    expect(explanation.overall.display).toBeNull();
    const reasons = explanation.components.map(c => c.excludedReason);
    expect(reasons).toEqual([
      null,
      EXCLUDED_ZERO_WEIGHT_REASON,
      INSUFFICIENT_DATA_REASON,
      EXCLUDED_MISSING_REASON,
    ]);
    expect(explanation.components[0]?.display).toBe(4);
  });
});
