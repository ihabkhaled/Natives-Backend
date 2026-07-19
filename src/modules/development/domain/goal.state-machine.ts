import { GoalStatus, GoalTransition } from '../model/goal.enums';

/**
 * Pure lifecycle state machine for a development goal. A proposed goal is agreed
 * (activated) or cancelled; an active goal is achieved, missed, or cancelled; a
 * terminal goal (achieved/missed/cancelled) may be reopened to active when a
 * review reverses the outcome. No side effects, no time, no persistence — every
 * branch is unit-tested.
 */

const TRANSITIONS: ReadonlyMap<GoalStatus, readonly GoalStatus[]> = new Map([
  [GoalStatus.Proposed, [GoalStatus.Active, GoalStatus.Cancelled]],
  [
    GoalStatus.Active,
    [GoalStatus.Achieved, GoalStatus.Missed, GoalStatus.Cancelled],
  ],
  [GoalStatus.Achieved, [GoalStatus.Active]],
  [GoalStatus.Missed, [GoalStatus.Active]],
  [GoalStatus.Cancelled, [GoalStatus.Active]],
]);

/** The set of states reachable from `from` in one transition. */
export function allowedGoalTransitions(
  from: GoalStatus,
): readonly GoalStatus[] {
  return TRANSITIONS.get(from) ?? [];
}

/** True when moving from `from` to `to` is a permitted lifecycle transition. */
export function canTransitionGoal(from: GoalStatus, to: GoalStatus): boolean {
  return allowedGoalTransitions(from).includes(to);
}

/** Map a requested transition verb to the status it targets. */
export function resolveGoalTarget(transition: GoalTransition): GoalStatus {
  if (transition === GoalTransition.Activate) {
    return GoalStatus.Active;
  }
  if (transition === GoalTransition.Achieve) {
    return GoalStatus.Achieved;
  }
  if (transition === GoalTransition.Miss) {
    return GoalStatus.Missed;
  }
  if (transition === GoalTransition.Cancel) {
    return GoalStatus.Cancelled;
  }
  return GoalStatus.Active;
}

/** Achieving a goal stamps a completion instant; other targets clear it. */
export function isGoalCompletion(target: GoalStatus): boolean {
  return target === GoalStatus.Achieved;
}

/** A goal only counts against a member's active workload while it is active. */
export function isGoalOpen(status: GoalStatus): boolean {
  return status === GoalStatus.Proposed || status === GoalStatus.Active;
}
