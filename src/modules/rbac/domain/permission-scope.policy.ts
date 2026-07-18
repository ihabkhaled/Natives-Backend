import type { PermissionScope } from '@core/auth';

import type { PermissionGrant } from '../model/rbac.types';

/**
 * A grant covers a request scope when every scope dimension the grant constrains
 * is satisfied by the request:
 *  - a null grant dimension (team or season) is global and matches anything;
 *  - a non-null grant dimension requires an exactly-equal request dimension.
 *
 * Consequences: a global (null/null) grant applies everywhere; a team-scoped
 * grant never applies to a request for a different team or to a global (no-team)
 * request. This is what denies cross-team / cross-season access.
 */
export function grantCoversScope(
  grant: PermissionGrant,
  scope: PermissionScope,
): boolean {
  if (grant.teamId !== null && grant.teamId !== scope.teamId) {
    return false;
  }
  if (grant.seasonId !== null && grant.seasonId !== scope.seasonId) {
    return false;
  }
  return true;
}

/**
 * A grant is in effect at `now` when its effective window has opened and has not
 * yet closed: effectiveFrom <= now < effectiveTo (open-ended when effectiveTo is
 * null). Future and expired grants are excluded.
 */
export function grantIsInEffect(grant: PermissionGrant, now: Date): boolean {
  const nowMs = now.getTime();
  if (grant.effectiveFrom.getTime() > nowMs) {
    return false;
  }
  return grant.effectiveTo === null || grant.effectiveTo.getTime() > nowMs;
}
