import { FixtureScheduleError } from '../errors/fixture-schedule.error';

/**
 * Pure scheduling invariants for a fixture. A fixture may only be booked on a
 * calendar day (as presented in the competition's Africa/Cairo timezone) that
 * falls inside the competition's date window when one is defined; a null window
 * bound is treated as open. A reschedule must actually move the fixture to a
 * different instant. Inputs are primitive (a Cairo date-only string and epoch
 * millis) so the rule stays free of clock or timezone dependencies. A violation is
 * a 400 domain validation error. No side effects, no persistence.
 */

/** True when `cairoDate` (YYYY-MM-DD) is inside [startsOn, endsOn] (open nulls). */
export function isWithinWindow(
  cairoDate: string,
  startsOn: string | null,
  endsOn: string | null,
): boolean {
  if (startsOn !== null && cairoDate < startsOn) {
    return false;
  }
  if (endsOn !== null && cairoDate > endsOn) {
    return false;
  }
  return true;
}

/** Assert the Cairo calendar day of the fixture is inside the competition window. */
export function assertFixtureWithinWindow(
  cairoDate: string,
  startsOn: string | null,
  endsOn: string | null,
): void {
  if (!isWithinWindow(cairoDate, startsOn, endsOn)) {
    throw new FixtureScheduleError();
  }
}

/** Assert a reschedule moves the fixture to a genuinely different instant. */
export function assertRescheduleMovesFixture(
  currentEpochMs: number,
  newEpochMs: number,
): void {
  if (currentEpochMs === newEpochMs) {
    throw new FixtureScheduleError();
  }
}
