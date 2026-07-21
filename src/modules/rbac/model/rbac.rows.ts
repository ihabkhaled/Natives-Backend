/**
 * Raw persistence row shapes (snake_case) returned by the RBAC SQL layer.
 * Repositories map these into vendor-free domain types so implementation files
 * stay free of inline declarations.
 */

export interface PolicyVersionRow {
  readonly version: number;
}

export interface PermissionGrantRow {
  readonly permission: string;
  readonly team_id: string | null;
  readonly season_id: string | null;
  readonly effective_from: string | Date;
  readonly effective_to: string | Date | null;
}

export interface RoleRow {
  readonly id: string;
  readonly key: string;
}

export interface PermissionKeyRow {
  readonly key: string;
}

export interface RoleAssignmentRow {
  readonly id: string;
  readonly user_id: string;
  readonly role_id: string;
  readonly role_key: string;
  readonly team_id: string | null;
  readonly season_id: string | null;
  readonly effective_from: string | Date;
  readonly effective_to: string | Date | null;
  readonly granted_by: string | null;
  readonly revoked_at: string | Date | null;
  readonly created_at: string | Date;
  readonly version: number;
}

export interface AffectedRow {
  readonly id: string;
}

/** One (role, permission) pair of the seeded catalog, flattened for grouping. */
export interface RoleCatalogRow {
  readonly role_key: string;
  readonly permission_key: string;
}

/** One seeded permission of the catalog, as the matrix read model returns it. */
export interface PermissionCatalogRow {
  readonly key: string;
  readonly area: string;
  readonly description: string;
}

/** One seeded role bundle header, without its permissions. */
export interface RoleDefinitionRow {
  readonly key: string;
  readonly display_name: string;
  readonly description: string;
  readonly is_system: boolean;
}
