import { PointsRuleStatus, PointsRuleTransition } from '../model/points.enums';

/**
 * Pure lifecycle state machine for a named points-rule version
 * (DRAFT → APPROVED → PUBLISHED → RETIRED). A draft is approved or discarded; an
 * approved rule is published, reverted to draft for further edits, or abandoned; a
 * published rule is retired when superseded. No side effects, no time, no
 * persistence — every branch is unit-tested.
 */

const TRANSITIONS: ReadonlyMap<PointsRuleStatus, readonly PointsRuleStatus[]> =
  new Map([
    [
      PointsRuleStatus.Draft,
      [PointsRuleStatus.Approved, PointsRuleStatus.Retired],
    ],
    [
      PointsRuleStatus.Approved,
      [
        PointsRuleStatus.Published,
        PointsRuleStatus.Draft,
        PointsRuleStatus.Retired,
      ],
    ],
    [PointsRuleStatus.Published, [PointsRuleStatus.Retired]],
    [PointsRuleStatus.Retired, []],
  ]);

/** The set of states reachable from `from` in one transition. */
export function allowedRuleTransitions(
  from: PointsRuleStatus,
): readonly PointsRuleStatus[] {
  return TRANSITIONS.get(from) ?? [];
}

/** True when moving from `from` to `to` is a permitted lifecycle transition. */
export function canTransitionRule(
  from: PointsRuleStatus,
  to: PointsRuleStatus,
): boolean {
  return allowedRuleTransitions(from).includes(to);
}

/** Map a requested transition verb to the status it targets. */
export function resolveRuleTarget(
  transition: PointsRuleTransition,
): PointsRuleStatus {
  if (transition === PointsRuleTransition.Approve) {
    return PointsRuleStatus.Approved;
  }
  if (transition === PointsRuleTransition.Publish) {
    return PointsRuleStatus.Published;
  }
  if (transition === PointsRuleTransition.Revert) {
    return PointsRuleStatus.Draft;
  }
  return PointsRuleStatus.Retired;
}

/** Publishing stamps a publication instant and actor. */
export function isPublishTarget(target: PointsRuleStatus): boolean {
  return target === PointsRuleStatus.Published;
}

/** Retiring stamps a retirement instant. */
export function isRetireTarget(target: PointsRuleStatus): boolean {
  return target === PointsRuleStatus.Retired;
}
