import { RBAC_TEAM_ROLE_SCOPE } from '../model/rbac.constants';
import type { RbacRoleRecord } from '../model/rbac.types';

/**
 * Structural protection rule for the role catalog. A role is protected — never
 * grantable through an ordinary team-scoped flow (invitation, role replace,
 * scoped assignment) — when it is platform-scoped or explicitly marked
 * unassignable. SUPER_ADMIN is both, so a team invite can never mint one; the
 * separately guarded platform promotion flow is the only path. Pure predicate:
 * no I/O, no clock.
 */
export function isProtectedRole(role: RbacRoleRecord): boolean {
  return role.scope !== RBAC_TEAM_ROLE_SCOPE || !role.isAssignable;
}
