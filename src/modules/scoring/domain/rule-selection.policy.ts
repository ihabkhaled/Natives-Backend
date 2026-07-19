import { CalculationRuleStatus } from '../model/scoring.enums';
import type { CalculationRule } from '../model/scoring.types';

/**
 * Pure selection of the effective published rule for a moment in time. Among the
 * published candidates whose effective window contains the as-of date (an open
 * start/end when a bound is null), the highest version wins. Draft, approved, and
 * retired rules are never effective. Returns null when nothing applies — the
 * caller treats that as "no active rule", never a silent default. Every branch is
 * unit-tested.
 */
export function selectEffectiveRule(
  rules: readonly CalculationRule[],
  asOf: string,
): CalculationRule | null {
  let selected: CalculationRule | null = null;
  for (const rule of rules) {
    if (!isEffective(rule, asOf)) {
      continue;
    }
    if (selected === null || rule.version > selected.version) {
      selected = rule;
    }
  }
  return selected;
}

function isEffective(rule: CalculationRule, asOf: string): boolean {
  if (rule.status !== CalculationRuleStatus.Published) {
    return false;
  }
  if (rule.effectiveFrom !== null && asOf < rule.effectiveFrom) {
    return false;
  }
  if (rule.effectiveTo !== null && asOf > rule.effectiveTo) {
    return false;
  }
  return true;
}
