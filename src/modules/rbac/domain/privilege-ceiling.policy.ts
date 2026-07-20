import type { RoleBundleRecord } from '../model/rbac.types';

/**
 * Anti-escalation / privilege-ceiling rule. An actor may only grant a role whose
 * every permission the actor themselves already holds within the same scope.
 * This prevents privilege escalation: no one can hand out a capability they do
 * not possess. Returns true when the grant is within the actor's ceiling.
 */
export function isWithinPrivilegeCeiling(
  actorPermissions: ReadonlySet<string>,
  targetPermissions: readonly string[],
): boolean {
  return targetPermissions.every(permission =>
    actorPermissions.has(permission),
  );
}

/**
 * The subset of the role catalog the actor may grant or revoke: every bundle
 * fully contained in the actor's own effective permissions for the target
 * scope. Same rule as `isWithinPrivilegeCeiling`, expressed as a projection so
 * a UI can render the ceiling instead of discovering it through a 403.
 */
export function selectAssignableRoles(
  bundles: readonly RoleBundleRecord[],
  actorPermissions: ReadonlySet<string>,
): readonly string[] {
  return bundles
    .filter(bundle =>
      isWithinPrivilegeCeiling(actorPermissions, bundle.permissions),
    )
    .map(bundle => bundle.roleKey);
}
