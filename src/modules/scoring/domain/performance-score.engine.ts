import {
  CONFIDENCE_HIGH_THRESHOLD,
  CONFIDENCE_MEDIUM_THRESHOLD,
} from '../model/scoring.constants';
import { ScoreConfidence } from '../model/scoring.enums';
import type {
  CategoryInput,
  ComponentScore,
  PerformanceScoreResult,
  RuleComponent,
  ScoreRuleDefinition,
  WeightedAggregation,
  WeightedComponent,
} from '../model/scoring.types';

/**
 * The pure, deterministic performance-score calculation core (UN-303). No clock,
 * no persistence, no rounding — every displayed number is a projection of these
 * functions over source facts and a named rule version. Missing inputs stay null
 * and are EXCLUDED (never averaged as zero); a measured zero is a present value
 * that lowers the mean. Every branch here is unit- and golden-tested.
 */

/**
 * Weighted mean over the components that actually have data. A component counts
 * only when its value is non-null AND its weight is positive; everything else is
 * excluded and named. The result carries the exact numerator/denominator so the
 * arithmetic can be explained and reproduced. Value is null (not zero) when no
 * component contributed.
 */
export function aggregateWeighted(
  components: readonly WeightedComponent[],
): WeightedAggregation {
  const includedKeys: string[] = [];
  const excludedKeys: string[] = [];
  let numerator = 0;
  let denominator = 0;
  for (const component of components) {
    if (component.value === null || component.weight <= 0) {
      excludedKeys.push(component.key);
      continue;
    }
    numerator += component.value * component.weight;
    denominator += component.weight;
    includedKeys.push(component.key);
  }
  const value = denominator > 0 ? numerator / denominator : null;
  return { value, numerator, denominator, includedKeys, excludedKeys };
}

/**
 * A category score is the equal-weight mean of its assessed metric values. Null
 * entries are missing observations and are excluded; a 0 is a measured value and
 * is included. No assessed value yields null (not zero).
 */
export function computeCategoryScore(
  values: readonly (number | null)[],
): WeightedAggregation {
  const components: WeightedComponent[] = values.map((value, index) => ({
    key: String(index),
    value,
    weight: 1,
  }));
  return aggregateWeighted(components);
}

/** Map completeness + presence to a data-confidence band. */
export function deriveConfidence(
  completeness: number,
  includedCount: number,
): ScoreConfidence {
  if (includedCount === 0) {
    return ScoreConfidence.None;
  }
  if (completeness >= CONFIDENCE_HIGH_THRESHOLD) {
    return ScoreConfidence.High;
  }
  if (completeness >= CONFIDENCE_MEDIUM_THRESHOLD) {
    return ScoreConfidence.Medium;
  }
  return ScoreConfidence.Low;
}

/** True when a component has enough data to enter the weighted mean. */
export function isComponentPresent(
  component: RuleComponent,
  input: CategoryInput | undefined,
): input is CategoryInput {
  return (
    input !== undefined &&
    input.value !== null &&
    component.weight > 0 &&
    input.assessedMetrics >= component.minSample
  );
}

/**
 * Run a rule against a membership's category inputs. Produces the overall value,
 * its exact arithmetic, per-component scores, and the completeness/confidence
 * indicators. When fewer components are present than the rule's minimum, the
 * overall value is withheld (null) even though the arithmetic is still reported.
 */
export function computePerformanceScore(
  rule: ScoreRuleDefinition,
  inputs: readonly CategoryInput[],
): PerformanceScoreResult {
  const byKey = indexInputs(inputs);
  const components = rule.components.map(component =>
    scoreComponent(component, byKey.get(component.categoryKey)),
  );
  const overall = aggregateWeighted(
    components.map(component => ({
      key: component.categoryKey,
      value: component.included ? component.value : null,
      weight: component.weight,
    })),
  );
  const includedCount = overall.includedKeys.length;
  const excludedCount = rule.components.length - includedCount;
  const sufficient = includedCount >= rule.minComponents;
  const completeness =
    rule.components.length > 0 ? includedCount / rule.components.length : 0;
  return {
    value: sufficient ? overall.value : null,
    numerator: overall.numerator,
    denominator: overall.denominator,
    includedCount,
    excludedCount,
    sufficient,
    completeness,
    confidence: deriveConfidence(completeness, includedCount),
    components,
  };
}

function indexInputs(
  inputs: readonly CategoryInput[],
): ReadonlyMap<string, CategoryInput> {
  const map = new Map<string, CategoryInput>();
  for (const input of inputs) {
    map.set(input.categoryKey, input);
  }
  return map;
}

function scoreComponent(
  component: RuleComponent,
  input: CategoryInput | undefined,
): ComponentScore {
  const present = isComponentPresent(component, input);
  const value = present ? input.value : null;
  return {
    categoryKey: component.categoryKey,
    weight: component.weight,
    value,
    contribution: value === null ? null : value * component.weight,
    included: present,
    assessedMetrics: input?.assessedMetrics ?? 0,
    totalMetrics: input?.totalMetrics ?? 0,
  };
}
