import type { RoleAssignment, RoleSetDiff } from '../model/rbac.types';

/**
 * Reconcile a requested team role set against the assignments a user currently
 * holds in that team: grant what is missing, revoke what is no longer wanted,
 * leave the overlap untouched so an unchanged role keeps its original grant
 * timestamp and audit trail. Pure — no clock, no I/O, no ordering assumptions
 * beyond the caller's deterministic input order.
 */
export function diffTeamRoles(
  current: readonly RoleAssignment[],
  requestedRoleKeys: readonly string[],
): RoleSetDiff {
  const requested = new Set(requestedRoleKeys);
  const held = new Set(current.map(assignment => assignment.roleKey));
  return {
    toGrant: [...requested].filter(roleKey => !held.has(roleKey)),
    toRevoke: current.filter(assignment => !requested.has(assignment.roleKey)),
  };
}
