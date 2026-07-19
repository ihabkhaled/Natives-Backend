import { ScoringValidationError } from '../errors/scoring-validation.error';
import {
  COMPONENT_MIN_SAMPLE_MAX,
  COMPONENT_MIN_SAMPLE_MIN,
  COMPONENT_WEIGHT_MAX,
  COMPONENT_WEIGHT_MIN,
  MIN_COMPONENTS_FLOOR,
  RULE_COMPONENTS_MAX_ITEMS,
  RULE_COMPONENTS_MIN_ITEMS,
  RULE_NAME_MIN_LENGTH,
  SCALE_MAX_CEILING,
  SCALE_MIN_FLOOR,
} from '../model/scoring.constants';
import type { RuleComponent, RuleContent } from '../model/scoring.types';

/**
 * Pure validation of a calculation-rule definition. Guards the weighted-component
 * shape (bounded, positively weighted, unique categories), the numeric scale, the
 * minimum-components floor, and the optional effective-date window. No side
 * effects, no persistence — every branch is unit-tested. Rounding and DTO-level
 * bounds live elsewhere; this enforces the invariants the engine relies on.
 */
export function assertRuleContent(content: RuleContent): void {
  if (content.name.trim().length < RULE_NAME_MIN_LENGTH) {
    throw new ScoringValidationError();
  }
  assertScale(content.scaleMin, content.scaleMax);
  assertComponents(content.components);
  assertMinComponents(content.minComponents, content.components.length);
  assertEffectiveWindow(content.effectiveFrom, content.effectiveTo);
}

function assertScale(scaleMin: number, scaleMax: number): void {
  if (!Number.isFinite(scaleMin) || !Number.isFinite(scaleMax)) {
    throw new ScoringValidationError();
  }
  if (scaleMin < SCALE_MIN_FLOOR || scaleMax > SCALE_MAX_CEILING) {
    throw new ScoringValidationError();
  }
  if (scaleMin >= scaleMax) {
    throw new ScoringValidationError();
  }
}

function assertComponents(components: readonly RuleComponent[]): void {
  if (
    components.length < RULE_COMPONENTS_MIN_ITEMS ||
    components.length > RULE_COMPONENTS_MAX_ITEMS
  ) {
    throw new ScoringValidationError();
  }
  const seen = new Set<string>();
  for (const component of components) {
    assertComponent(component);
    if (seen.has(component.categoryKey)) {
      throw new ScoringValidationError();
    }
    seen.add(component.categoryKey);
  }
}

function assertComponent(component: RuleComponent): void {
  if (
    !Number.isFinite(component.weight) ||
    component.weight < COMPONENT_WEIGHT_MIN ||
    component.weight > COMPONENT_WEIGHT_MAX
  ) {
    throw new ScoringValidationError();
  }
  if (
    !Number.isInteger(component.minSample) ||
    component.minSample < COMPONENT_MIN_SAMPLE_MIN ||
    component.minSample > COMPONENT_MIN_SAMPLE_MAX
  ) {
    throw new ScoringValidationError();
  }
}

function assertMinComponents(minComponents: number, total: number): void {
  if (!Number.isInteger(minComponents)) {
    throw new ScoringValidationError();
  }
  if (minComponents < MIN_COMPONENTS_FLOOR || minComponents > total) {
    throw new ScoringValidationError();
  }
}

function assertEffectiveWindow(
  effectiveFrom: string | null,
  effectiveTo: string | null,
): void {
  if (
    effectiveFrom !== null &&
    effectiveTo !== null &&
    effectiveFrom > effectiveTo
  ) {
    throw new ScoringValidationError();
  }
}
