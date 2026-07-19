import {
  CalculationRuleStatus,
  CalculationRuleTransition,
} from '../model/scoring.enums';

/**
 * Pure lifecycle state machine for a named calculation-rule version, following
 * the `points_rule` pattern (DRAFT → APPROVED → PUBLISHED → RETIRED). A draft is
 * approved or discarded; an approved rule is published, reverted to draft for
 * further edits, or abandoned; a published rule is retired when superseded. No
 * side effects, no time, no persistence — every branch is unit-tested.
 */

const TRANSITIONS: ReadonlyMap<
  CalculationRuleStatus,
  readonly CalculationRuleStatus[]
> = new Map([
  [
    CalculationRuleStatus.Draft,
    [CalculationRuleStatus.Approved, CalculationRuleStatus.Retired],
  ],
  [
    CalculationRuleStatus.Approved,
    [
      CalculationRuleStatus.Published,
      CalculationRuleStatus.Draft,
      CalculationRuleStatus.Retired,
    ],
  ],
  [CalculationRuleStatus.Published, [CalculationRuleStatus.Retired]],
  [CalculationRuleStatus.Retired, []],
]);

/** The set of states reachable from `from` in one transition. */
export function allowedRuleTransitions(
  from: CalculationRuleStatus,
): readonly CalculationRuleStatus[] {
  return TRANSITIONS.get(from) ?? [];
}

/** True when moving from `from` to `to` is a permitted lifecycle transition. */
export function canTransitionRule(
  from: CalculationRuleStatus,
  to: CalculationRuleStatus,
): boolean {
  return allowedRuleTransitions(from).includes(to);
}

/** Map a requested transition verb to the status it targets. */
export function resolveRuleTarget(
  transition: CalculationRuleTransition,
): CalculationRuleStatus {
  if (transition === CalculationRuleTransition.Approve) {
    return CalculationRuleStatus.Approved;
  }
  if (transition === CalculationRuleTransition.Publish) {
    return CalculationRuleStatus.Published;
  }
  if (transition === CalculationRuleTransition.Revert) {
    return CalculationRuleStatus.Draft;
  }
  return CalculationRuleStatus.Retired;
}

/** Only a draft rule may have its content edited. */
export function isRuleEditable(status: CalculationRuleStatus): boolean {
  return status === CalculationRuleStatus.Draft;
}

/** Publishing stamps a publication instant and actor. */
export function isPublishTarget(target: CalculationRuleStatus): boolean {
  return target === CalculationRuleStatus.Published;
}

/** Retiring stamps a retirement instant. */
export function isRetireTarget(target: CalculationRuleStatus): boolean {
  return target === CalculationRuleStatus.Retired;
}
