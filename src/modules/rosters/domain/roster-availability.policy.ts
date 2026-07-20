import { RosterAvailabilityStatus, RosterStatus } from '../model/rosters.enums';

/**
 * Pure availability rules (UN-502). A member's going / not-going declaration is
 * only meaningful while the selection is still open: once a roster is locked,
 * revised, or archived the declaration window is closed and the availability
 * recorded on the frozen entries is the historical truth.
 *
 * Null-not-zero: an undeclared availability stays null. It is never coerced to
 * "unavailable", and a missing declaration never counts as a refusal.
 */

/** True when a member may still declare or change their availability. */
export function isDeclarationOpen(status: RosterStatus): boolean {
  return status === RosterStatus.Draft || status === RosterStatus.Published;
}

/** True when the declaration deadline has passed at `now` (null = no deadline). */
export function isDeadlinePassed(deadline: Date | null, now: Date): boolean {
  return deadline !== null && now.getTime() >= deadline.getTime();
}

/** True when a member may declare right now: window open and deadline not past. */
export function canDeclareAvailability(
  status: RosterStatus,
  deadline: Date | null,
  now: Date,
): boolean {
  return isDeclarationOpen(status) && !isDeadlinePassed(deadline, now);
}

/**
 * The availability to freeze on an entry at selection time. An undeclared member
 * yields null — a coach may still roster them, and the entry honestly records
 * that nothing was declared.
 */
export function resolveEntryAvailability(
  declared: RosterAvailabilityStatus | null,
): RosterAvailabilityStatus | null {
  return declared;
}

/** True when the declaration contradicts an active selection (advisory only). */
export function contradictsSelection(
  declared: RosterAvailabilityStatus | null,
): boolean {
  return declared === RosterAvailabilityStatus.Unavailable;
}
