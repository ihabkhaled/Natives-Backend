import {
  EXCLUDED_MISSING_REASON,
  EXCLUDED_ZERO_WEIGHT_REASON,
  INSUFFICIENT_DATA_REASON,
  SCORE_DISPLAY_DECIMALS,
} from '../model/scoring.constants';
import type {
  ComponentExplanation,
  ComponentScore,
  PerformanceScoreResult,
  ScoreExplanation,
  ScoreRuleDefinition,
} from '../model/scoring.types';
import { roundNullable } from './scoring.helpers';

/**
 * Assembles the self-contained explanation carried by every projected score: the
 * rule version it came from, the exact overall arithmetic (numerator, denominator,
 * excluded count) with both the unrounded and rounded-display values, a per-
 * component breakdown that names why anything was excluded, and the
 * completeness/confidence indicators. Pure — rounding happens here at the
 * presentation boundary only. No side effects, no persistence.
 */
export function buildScoreExplanation(
  rule: ScoreRuleDefinition,
  result: PerformanceScoreResult,
): ScoreExplanation {
  return {
    rule: {
      ruleId: rule.ruleId,
      ruleKey: rule.ruleKey,
      version: rule.version,
      name: rule.name,
    },
    overall: {
      unrounded: result.value,
      display: roundNullable(result.value, SCORE_DISPLAY_DECIMALS),
      numerator: result.numerator,
      denominator: result.denominator,
      includedCount: result.includedCount,
      excludedCount: result.excludedCount,
      sufficient: result.sufficient,
    },
    components: result.components.map(component => explainComponent(component)),
    completeness: result.completeness,
    confidence: result.confidence,
    formulaVersion: rule.version,
  };
}

function explainComponent(component: ComponentScore): ComponentExplanation {
  return {
    categoryKey: component.categoryKey,
    weight: component.weight,
    unrounded: component.value,
    display: roundNullable(component.value, SCORE_DISPLAY_DECIMALS),
    included: component.included,
    assessedMetrics: component.assessedMetrics,
    totalMetrics: component.totalMetrics,
    excludedReason: resolveExcludedReason(component),
  };
}

function resolveExcludedReason(component: ComponentScore): string | null {
  if (component.included) {
    return null;
  }
  if (component.weight <= 0) {
    return EXCLUDED_ZERO_WEIGHT_REASON;
  }
  if (component.assessedMetrics > 0) {
    return INSUFFICIENT_DATA_REASON;
  }
  return EXCLUDED_MISSING_REASON;
}
