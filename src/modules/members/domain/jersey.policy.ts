import type { JerseyReservation } from '../model/members.types';

/**
 * Pure jersey-reservation rules. Scoped active jersey uniqueness is enforced in
 * the application layer over a bounded set of active reservations (a DB-level
 * exclusion constraint spanning membership status/season is deferred and
 * documented). Numbers of 0 are legitimate jerseys — the null jersey (no number
 * assigned) is distinct from the measured zero.
 */

/**
 * Find an existing active reservation of `jerseyNumber` held by a different
 * membership, or null when the number is free. The member being edited is
 * excluded so re-saving its own number is not a self-collision.
 */
export function findJerseyConflict(
  reservations: readonly JerseyReservation[],
  jerseyNumber: number,
  excludeMembershipId: string,
): JerseyReservation | null {
  for (const reservation of reservations) {
    if (reservation.membershipId === excludeMembershipId) {
      continue;
    }
    if (reservation.jerseyNumber === jerseyNumber) {
      return reservation;
    }
  }
  return null;
}
