import { RosterValidationError } from '../errors/roster-validation.error';
import {
  MIN_WOMEN_MIN,
  ROSTER_SIZE_MAX,
  ROSTER_SIZE_MIN,
} from '../model/rosters.constants';
import type { RosterConstraints } from '../model/rosters.types';

/**
 * Pure content invariants for a roster's composition constraints: the size window
 * must be a real window inside the supported bounds, and a stated minimum number
 * of women must be non-negative and reachable within the maximum size. A null
 * minimum means the division rule does not apply — it is never read as zero.
 * No side effects, no persistence; a violation is a 400 domain validation error.
 */
export function assertRosterConstraints(constraints: RosterConstraints): void {
  assertSizeWindow(constraints);
  assertMinWomen(constraints);
}

function assertSizeWindow(constraints: RosterConstraints): void {
  if (
    constraints.minSize < ROSTER_SIZE_MIN ||
    constraints.maxSize > ROSTER_SIZE_MAX ||
    constraints.minSize > constraints.maxSize
  ) {
    throw new RosterValidationError();
  }
}

function assertMinWomen(constraints: RosterConstraints): void {
  if (constraints.minWomen === null) {
    return;
  }
  if (
    constraints.minWomen < MIN_WOMEN_MIN ||
    constraints.minWomen > constraints.maxSize
  ) {
    throw new RosterValidationError();
  }
}
