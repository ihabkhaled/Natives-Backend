import { DevelopmentValidationError } from '../errors/development-validation.error';
import {
  GOAL_NUMERIC_MAX,
  GOAL_NUMERIC_MIN,
  GOAL_TITLE_MIN_LENGTH,
} from '../model/development.constants';
import { GoalStatus } from '../model/goal.enums';
import type { GoalAction, GoalContent } from '../model/goal.types';

/**
 * Pure business rules for development-goal content and overdue detection. Numeric
 * fields honour null-not-zero: a NULL target/baseline/progress is a legitimate
 * "not measured" and is never treated as a real zero. No side effects, no time,
 * no persistence — every branch is unit-tested.
 */

/**
 * Validate the editable goal content: a non-blank title, finite in-range numeric
 * fields (null allowed = not measured), and action-plan steps that each carry a
 * non-blank description and a finite ordering key.
 */
export function assertGoalContent(content: GoalContent): void {
  if (content.title.trim().length < GOAL_TITLE_MIN_LENGTH) {
    throw new DevelopmentValidationError();
  }
  assertNumericInRange(content.targetValue);
  assertNumericInRange(content.baselineValue);
  assertNumericInRange(content.progressValue);
  assertActions(content.actions);
}

function assertActions(actions: readonly GoalAction[]): void {
  const seen = new Set<number>();
  for (const action of actions) {
    if (action.description.trim().length === 0) {
      throw new DevelopmentValidationError();
    }
    if (!Number.isInteger(action.sortOrder) || seen.has(action.sortOrder)) {
      throw new DevelopmentValidationError();
    }
    seen.add(action.sortOrder);
  }
}

function assertNumericInRange(value: number | null): void {
  if (value === null) {
    return;
  }
  if (!Number.isFinite(value)) {
    throw new DevelopmentValidationError();
  }
  if (value < GOAL_NUMERIC_MIN || value > GOAL_NUMERIC_MAX) {
    throw new DevelopmentValidationError();
  }
}

/**
 * True when an active goal's due date has passed. Compares ISO date-only strings
 * (YYYY-MM-DD) lexicographically, which is chronologically correct for that
 * fixed-width format; a goal with no due date is never overdue.
 */
export function isGoalOverdue(
  status: GoalStatus,
  dueDate: string | null,
  now: Date,
): boolean {
  if (status !== GoalStatus.Active || dueDate === null) {
    return false;
  }
  return dueDate < now.toISOString().slice(0, 10);
}
