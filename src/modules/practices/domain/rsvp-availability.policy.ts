import { RsvpStatus } from '../model/rsvp.enums';
import type { RsvpSlotState } from '../model/rsvp.types';

/**
 * Pure availability / waitlist rules for practice RSVP. No time, no persistence —
 * every branch is unit-tested with golden cases. The only source of truth for
 * whether a `going` answer is confirmed or waitlisted, and whether changing a
 * response frees a confirmed spot that a waitlisted member can be promoted into.
 */

/**
 * Decide whether a response should land on the waitlist. Only a `going` answer can
 * be waitlisted, and only when the session is capped and its confirmed-going count
 * (excluding this member) has already reached capacity. An uncapped session
 * (`capacity === null`) never waitlists (null-not-zero: uncapped is not "0 spots").
 */
export function resolveWaitlisted(
  capacity: number | null,
  targetStatus: RsvpStatus,
  confirmedGoingExcludingSelf: number,
): boolean {
  if (targetStatus !== RsvpStatus.Going || capacity === null) {
    return false;
  }
  return confirmedGoingExcludingSelf >= capacity;
}

/** True when a confirmed `going` spot is available for a new/changed answer. */
export function hasFreeSpot(
  capacity: number | null,
  confirmedGoingExcludingSelf: number,
): boolean {
  return capacity === null || confirmedGoingExcludingSelf < capacity;
}

/** True when a member currently holds a confirmed (non-waitlisted) going spot. */
export function isConfirmedGoing(state: RsvpSlotState): boolean {
  return state.status === RsvpStatus.Going && !state.waitlisted;
}

/**
 * True when moving from `previous` to `current` vacates a confirmed going spot —
 * the trigger to promote the earliest waitlisted member. A member who was never
 * confirmed (absent, waitlisted, or not going) frees nothing.
 */
export function freedConfirmedSlot(
  previous: RsvpSlotState | null,
  current: RsvpSlotState,
): boolean {
  if (previous === null || !isConfirmedGoing(previous)) {
    return false;
  }
  return !isConfirmedGoing(current);
}
