import type { RoleAssignment } from '../model/rbac.types';

/**
 * A role assignment is live at `now` when it has not been revoked and its
 * effective window has opened but not yet closed: effectiveFrom <= now <
 * effectiveTo (open-ended when effectiveTo is null). Mirrors the grant window
 * used by permission resolution so a role that grants nothing is never listed
 * as held. Pure.
 */
export function assignmentIsLive(
  assignment: RoleAssignment,
  now: Date,
): boolean {
  if (assignment.revokedAt !== null) {
    return false;
  }
  const nowMs = now.getTime();
  if (assignment.effectiveFrom.getTime() > nowMs) {
    return false;
  }
  return (
    assignment.effectiveTo === null || assignment.effectiveTo.getTime() > nowMs
  );
}

/**
 * A live assignment applies to a team when it is global (no team constraint) or
 * bound to exactly that team. Season-bound assignments only apply when the
 * caller's context is that same season; a null assignment season is unbounded.
 */
export function assignmentAppliesToScope(
  assignment: RoleAssignment,
  teamId: string,
  seasonId: string | null,
): boolean {
  if (assignment.teamId !== null && assignment.teamId !== teamId) {
    return false;
  }
  return assignment.seasonId === null || assignment.seasonId === seasonId;
}
