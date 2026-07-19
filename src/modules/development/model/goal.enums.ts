/**
 * Lifecycle of a development goal. `proposed` is a drafted target; `active` is an
 * agreed, in-progress goal; `achieved` and `missed` are terminal outcomes;
 * `cancelled` withdraws a goal. Terminal outcomes may be reopened to `active` when
 * a review reverses them. Progress is null-not-zero: an unmeasured progress value
 * is NULL, never coerced to 0.
 */
export enum GoalStatus {
  Proposed = 'proposed',
  Active = 'active',
  Achieved = 'achieved',
  Missed = 'missed',
  Cancelled = 'cancelled',
}

export const GOAL_STATUS_VALUES: readonly GoalStatus[] =
  Object.values(GoalStatus);

/** A requested change of goal lifecycle state. */
export enum GoalTransition {
  Activate = 'activate',
  Achieve = 'achieve',
  Miss = 'miss',
  Cancel = 'cancel',
  Reopen = 'reopen',
}

export const GOAL_TRANSITION_VALUES: readonly GoalTransition[] =
  Object.values(GoalTransition);
