import { ROLE_PERMISSIONS } from '@shared/constants';
import type { Permission, Role } from '@shared/enums';

/**
 * The account-role baseline permission set for a principal's coarse account
 * roles, resolved from the in-code bundle catalog with no database round-trip.
 * This is the always-available floor unioned with database-backed scoped
 * assignments by the effective-permission resolver.
 */
export function bundlePermissionsForRoles(
  roles: readonly Role[],
): ReadonlySet<string> {
  const granted = new Set<string>();
  for (const role of roles) {
    for (const permission of ROLE_PERMISSIONS.get(role) ?? []) {
      granted.add(permission);
    }
  }
  return granted;
}

/** True when every required permission is present in the granted set. */
export function hasAllPermissions(
  granted: ReadonlySet<string>,
  requiredPermissions: readonly Permission[],
): boolean {
  return requiredPermissions.every(permission => granted.has(permission));
}
