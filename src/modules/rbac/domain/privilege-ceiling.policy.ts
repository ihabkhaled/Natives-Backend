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
