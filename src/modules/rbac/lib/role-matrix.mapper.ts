import type {
  PermissionCatalogRow,
  RoleCatalogRow,
  RoleDefinitionRow,
} from '../model/rbac.rows';
import type {
  PermissionCatalogRecord,
  RoleMatrixRole,
  RoleMatrixView,
} from '../model/rbac.types';

/** Map a seeded permission row into the catalog record the matrix exposes. */
export function toPermissionCatalogRecord(
  row: PermissionCatalogRow,
): PermissionCatalogRecord {
  return { key: row.key, area: row.area, description: row.description };
}

/**
 * Index the flattened (role, permission) catalog rows by role key. The rows
 * arrive in deterministic (role, permission) order, so each bucket preserves it.
 */
function indexPermissionsByRole(
  rows: readonly RoleCatalogRow[],
): ReadonlyMap<string, readonly string[]> {
  const byRole = new Map<string, string[]>();
  for (const row of rows) {
    const existing = byRole.get(row.role_key);
    if (existing === undefined) {
      byRole.set(row.role_key, [row.permission_key]);
    } else {
      existing.push(row.permission_key);
    }
  }
  return byRole;
}

/**
 * Join a role definition with the permission keys its bundle grants. A role with
 * no rows in `role_permissions` yields an empty bundle — never a missing entry,
 * so the matrix always has one column per role.
 */
export function toRoleMatrixRole(
  row: RoleDefinitionRow,
  permissionsByRole: ReadonlyMap<string, readonly string[]>,
): RoleMatrixRole {
  return {
    key: row.key,
    displayName: row.display_name,
    description: row.description,
    isSystem: row.is_system,
    permissions: permissionsByRole.get(row.key) ?? [],
  };
}

/**
 * Build the complete role x permission matrix from the three seeded tables. Pure:
 * no I/O, no clock. Ordering is inherited from the deterministically ordered
 * reads, so the same database always renders the same matrix.
 */
export function toRoleMatrixView(
  policyVersion: number,
  permissions: readonly PermissionCatalogRow[],
  roles: readonly RoleDefinitionRow[],
  bundles: readonly RoleCatalogRow[],
): RoleMatrixView {
  const permissionsByRole = indexPermissionsByRole(bundles);
  return {
    policyVersion,
    permissions: permissions.map(row => toPermissionCatalogRecord(row)),
    roles: roles.map(row => toRoleMatrixRole(row, permissionsByRole)),
  };
}
