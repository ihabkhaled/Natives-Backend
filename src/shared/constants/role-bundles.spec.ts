import { Permission, RBAC_ROLE_VALUES, RbacRole } from '@shared/enums';
import { describe, expect, it } from 'vitest';

import { PERMISSION_CATALOG_KEYS } from './permission-catalog.constants';
import { ROLE_BUNDLE_METADATA, ROLE_BUNDLES } from './role-bundles.constants';

function bundle(role: RbacRole): ReadonlySet<string> {
  return new Set<string>(ROLE_BUNDLES.get(role) ?? []);
}

describe('ROLE_BUNDLES', () => {
  it('defines all five default bundles with metadata', () => {
    expect(ROLE_BUNDLES.size).toBe(5);
    for (const role of RBAC_ROLE_VALUES) {
      expect(ROLE_BUNDLES.has(role)).toBe(true);
      expect(ROLE_BUNDLE_METADATA.has(role)).toBe(true);
    }
  });

  it('composes COACH as a superset of MEMBER', () => {
    const member = bundle(RbacRole.Member);
    const coach = bundle(RbacRole.Coach);

    for (const permission of member) {
      expect(coach.has(permission)).toBe(true);
    }
    expect(coach.size).toBeGreaterThan(member.size);
  });

  it('composes TEAM_ADMIN as a superset of COACH', () => {
    const coach = bundle(RbacRole.Coach);
    const teamAdmin = bundle(RbacRole.TeamAdmin);

    for (const permission of coach) {
      expect(teamAdmin.has(permission)).toBe(true);
    }
    expect(teamAdmin.has(Permission.MemberRolesManage)).toBe(true);
  });

  it('only bundles canonical catalog permissions', () => {
    const catalog = new Set<string>(PERMISSION_CATALOG_KEYS);
    for (const role of RBAC_ROLE_VALUES) {
      for (const permission of ROLE_BUNDLES.get(role) ?? []) {
        expect(catalog.has(permission)).toBe(true);
      }
    }
  });

  it('grants the scorekeeper match scoring and the analyst reporting', () => {
    expect(bundle(RbacRole.Scorekeeper).has(Permission.MatchScore)).toBe(true);
    expect(bundle(RbacRole.Analyst).has(Permission.ReportRead)).toBe(true);
    expect(bundle(RbacRole.Member).has(Permission.MemberInvite)).toBe(false);
  });
});
