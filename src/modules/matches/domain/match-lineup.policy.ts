import { LINE_SIZE_MAX, LINE_SIZE_MIN } from '../model/matches.constants';

/**
 * Pure constraints on the line that takes the field for a point. A lineup is the
 * ONLY source of "points played", so a malformed one is rejected outright rather
 * than silently producing a player who played half a point or played it twice.
 */

/** The line must hold at least one and at most the configured maximum players. */
export function isLineSizeValid(membershipIds: readonly string[]): boolean {
  return (
    membershipIds.length >= LINE_SIZE_MIN &&
    membershipIds.length <= LINE_SIZE_MAX
  );
}

/** The same player may not be listed twice on one line. */
export function hasUniqueMembers(membershipIds: readonly string[]): boolean {
  return new Set(membershipIds).size === membershipIds.length;
}

/** A named puller must actually be on the line that took the field. */
export function isPullerOnLine(
  membershipIds: readonly string[],
  pullerMembershipId: string | null,
): boolean {
  return (
    pullerMembershipId === null || membershipIds.includes(pullerMembershipId)
  );
}

/** The full lineup constraint set, evaluated as one pure predicate. */
export function isLineupValid(
  membershipIds: readonly string[],
  pullerMembershipId: string | null,
): boolean {
  return (
    isLineSizeValid(membershipIds) &&
    hasUniqueMembers(membershipIds) &&
    isPullerOnLine(membershipIds, pullerMembershipId)
  );
}
