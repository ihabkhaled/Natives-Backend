import {
  DEFAULT_SCALE_MAX,
  DEFAULT_SCALE_MIN,
  MIN_COMPONENTS_FLOOR,
} from '../model/scoring.constants';
import type {
  RuleComponent,
  RuleComponentInput,
  RuleContent,
  RuleContentInput,
} from '../model/scoring.types';

/**
 * Normalizes the loosely-typed transport input into the strict rule-content
 * command shape. Absent scale/floor fields fall back to the legacy 0–5 defaults,
 * and an absent per-component minimum sample becomes 0 — keeping controllers a
 * single delegation and downstream layers free of `undefined`.
 */
export function toRuleContent(input: RuleContentInput): RuleContent {
  return {
    ruleKey: input.ruleKey,
    name: input.name,
    description: input.description ?? null,
    seasonId: input.seasonId ?? null,
    scaleMin: input.scaleMin ?? DEFAULT_SCALE_MIN,
    scaleMax: input.scaleMax ?? DEFAULT_SCALE_MAX,
    minComponents: input.minComponents ?? MIN_COMPONENTS_FLOOR,
    effectiveFrom: input.effectiveFrom ?? null,
    effectiveTo: input.effectiveTo ?? null,
    components: input.components.map(component => toComponent(component)),
  };
}

function toComponent(input: RuleComponentInput): RuleComponent {
  return {
    categoryKey: input.categoryKey,
    weight: input.weight,
    minSample: input.minSample ?? 0,
  };
}
