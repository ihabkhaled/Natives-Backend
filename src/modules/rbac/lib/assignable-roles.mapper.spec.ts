import { describe, expect, it } from 'vitest';

import type { RoleDefinitionRow } from '../model/rbac.rows';
import { toAssignableRoleEntries } from './assignable-roles.mapper';

function definition(overrides: Partial<RoleDefinitionRow>): RoleDefinitionRow {
  return {
    key: 'MEMBER',
    display_name: 'Member',
    description: 'Baseline team member',
    is_system: true,
    scope: 'team',
    is_assignable: true,
    ...overrides,
  };
}

const CATALOG: readonly RoleDefinitionRow[] = [
  definition({}),
  definition({ key: 'COACH', display_name: 'Coach', description: 'Coaches' }),
  definition({
    key: 'SUPER_ADMIN',
    display_name: 'Super administrator',
    description: 'Platform-wide',
    scope: 'platform',
    is_assignable: false,
  }),
  definition({
    key: 'LEGACY',
    display_name: 'Legacy',
    description: 'Retired bundle',
    is_assignable: false,
  }),
];

describe('toAssignableRoleEntries', () => {
  it('joins ceiling slugs with team-scoped assignable display metadata', () => {
    expect(toAssignableRoleEntries(['coach', 'member'], CATALOG)).toEqual([
      { slug: 'coach', displayName: 'Coach', description: 'Coaches' },
      {
        slug: 'member',
        displayName: 'Member',
        description: 'Baseline team member',
      },
    ]);
  });

  it('drops a ceiling slug whose role is platform-scoped', () => {
    expect(toAssignableRoleEntries(['super_admin'], CATALOG)).toEqual([]);
  });

  it('drops a ceiling slug whose role is unassignable', () => {
    expect(toAssignableRoleEntries(['legacy'], CATALOG)).toEqual([]);
  });

  it('drops a slug absent from the catalog entirely', () => {
    expect(toAssignableRoleEntries(['ghost'], CATALOG)).toEqual([]);
  });

  it('preserves the incoming slug ordering', () => {
    const entries = toAssignableRoleEntries(['member', 'coach'], CATALOG);

    expect(entries.map(entry => entry.slug)).toEqual(['member', 'coach']);
  });

  it('is empty for an empty ceiling projection', () => {
    expect(toAssignableRoleEntries([], CATALOG)).toEqual([]);
  });
});
