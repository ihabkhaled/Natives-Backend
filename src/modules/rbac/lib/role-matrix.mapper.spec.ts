import { describe, expect, it } from 'vitest';

import type {
  PermissionCatalogRow,
  RoleCatalogRow,
  RoleDefinitionRow,
} from '../model/rbac.rows';
import {
  toPermissionCatalogRecord,
  toRoleMatrixRole,
  toRoleMatrixView,
} from './role-matrix.mapper';

const PERMISSIONS: readonly PermissionCatalogRow[] = [
  { key: 'platform.admin', area: 'platform', description: 'Administer' },
  { key: 'team.read', area: 'team', description: 'View a team' },
];

const ROLES: readonly RoleDefinitionRow[] = [
  {
    key: 'MEMBER',
    display_name: 'Member',
    description: 'Baseline member',
    is_system: true,
  },
  {
    key: 'SUPER_ADMIN',
    display_name: 'Super administrator',
    description: 'Platform-wide',
    is_system: true,
  },
];

const BUNDLES: readonly RoleCatalogRow[] = [
  { role_key: 'MEMBER', permission_key: 'team.read' },
  { role_key: 'SUPER_ADMIN', permission_key: 'platform.admin' },
  { role_key: 'SUPER_ADMIN', permission_key: 'team.read' },
];

function requireRole(index: number): RoleDefinitionRow {
  const row = ROLES[index];
  if (row === undefined) {
    throw new Error('Missing role fixture');
  }
  return row;
}

describe('toPermissionCatalogRecord', () => {
  it('maps a snake_case row onto the catalog record', () => {
    expect(
      toPermissionCatalogRecord({
        key: 'team.create',
        area: 'platform',
        description: 'Create a new team',
      }),
    ).toEqual({
      key: 'team.create',
      area: 'platform',
      description: 'Create a new team',
    });
  });
});

describe('toRoleMatrixRole', () => {
  it('joins a role definition with its bundle permissions', () => {
    const byRole = new Map<string, readonly string[]>([
      ['MEMBER', ['team.read']],
    ]);

    expect(toRoleMatrixRole(requireRole(0), byRole)).toEqual({
      key: 'MEMBER',
      displayName: 'Member',
      description: 'Baseline member',
      isSystem: true,
      permissions: ['team.read'],
    });
  });

  it('yields an empty bundle for a role with no permissions', () => {
    const role = toRoleMatrixRole(
      requireRole(1),
      new Map<string, readonly string[]>(),
    );

    expect(role.permissions).toEqual([]);
  });
});

describe('toRoleMatrixView', () => {
  it('builds the full matrix preserving the query ordering', () => {
    const view = toRoleMatrixView(7, PERMISSIONS, ROLES, BUNDLES);

    expect(view.policyVersion).toBe(7);
    expect(view.permissions.map(entry => entry.key)).toEqual([
      'platform.admin',
      'team.read',
    ]);
    expect(view.roles.map(role => role.key)).toEqual(['MEMBER', 'SUPER_ADMIN']);
    expect(view.roles[1]?.permissions).toEqual(['platform.admin', 'team.read']);
  });

  it('returns empty collections for an unseeded catalog', () => {
    expect(toRoleMatrixView(1, [], [], [])).toEqual({
      policyVersion: 1,
      permissions: [],
      roles: [],
    });
  });
});
