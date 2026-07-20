import { describe, expect, it } from 'vitest';

import type { RoleCatalogRow } from '../model/rbac.rows';
import { toRoleBundles } from './role-catalog.mapper';

describe('toRoleBundles', () => {
  it('groups flattened rows into one bundle per role, in query order', () => {
    const rows: readonly RoleCatalogRow[] = [
      { role_key: 'COACH', permission_key: 'practice.manage' },
      { role_key: 'COACH', permission_key: 'practice.read' },
      { role_key: 'MEMBER', permission_key: 'practice.read' },
    ];

    expect(toRoleBundles(rows)).toEqual([
      { roleKey: 'COACH', permissions: ['practice.manage', 'practice.read'] },
      { roleKey: 'MEMBER', permissions: ['practice.read'] },
    ]);
  });

  it('returns no bundles for an empty catalog', () => {
    expect(toRoleBundles([])).toEqual([]);
  });
});
