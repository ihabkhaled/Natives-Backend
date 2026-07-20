import type { RoleCatalogRow } from '../model/rbac.rows';
import type { RoleBundleRecord } from '../model/rbac.types';

/**
 * Group the flattened (role, permission) catalog rows into one bundle per role,
 * preserving the query's deterministic role order. Pure: no I/O, no clock.
 */
export function toRoleBundles(
  rows: readonly RoleCatalogRow[],
): readonly RoleBundleRecord[] {
  const byRole = new Map<string, string[]>();
  for (const row of rows) {
    const existing = byRole.get(row.role_key);
    if (existing === undefined) {
      byRole.set(row.role_key, [row.permission_key]);
    } else {
      existing.push(row.permission_key);
    }
  }
  return [...byRole].map(([roleKey, permissions]) => ({
    roleKey,
    permissions,
  }));
}
