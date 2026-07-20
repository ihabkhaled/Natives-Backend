import { RBAC_ROLE_VALUES, type RbacRole } from '@shared/enums';

/** The catalog widened to plain strings so a caller-supplied value can be compared. */
const ROLE_KEYS: ReadonlySet<string> = new Set<string>(RBAC_ROLE_VALUES);

/**
 * Translate between the stored role key (`TEAM_ADMIN`) and the lower-snake slug
 * clients exchange (`team_admin`). RBAC owns the role vocabulary, so both
 * directions live here and every other module consumes them through the public
 * barrel. `toRoleKey` returns null for anything outside the seeded catalog so a
 * caller-supplied value can never widen the role set.
 */
export function toRoleSlug(roleKey: string): string {
  return roleKey.toLowerCase();
}

export function toRoleKey(slug: string): RbacRole | null {
  const upper = slug.toUpperCase();
  return ROLE_KEYS.has(upper) ? (upper as RbacRole) : null;
}
