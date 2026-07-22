import { Permission, RBAC_ROLE_VALUES, RbacRole } from '@shared/enums';
import { describe, expect, it } from 'vitest';

import { PERMISSION_CATALOG_KEYS } from './permission-catalog.constants';
import { ROLE_BUNDLE_METADATA, ROLE_BUNDLES } from './role-bundles.constants';

function bundle(role: RbacRole): ReadonlySet<string> {
  return new Set<string>(ROLE_BUNDLES.get(role) ?? []);
}

describe('ROLE_BUNDLES', () => {
  it('defines all six default bundles with metadata', () => {
    expect(ROLE_BUNDLES.size).toBe(6);
    for (const role of RBAC_ROLE_VALUES) {
      expect(ROLE_BUNDLES.has(role)).toBe(true);
      expect(ROLE_BUNDLE_METADATA.has(role)).toBe(true);
    }
  });

  it('grants SUPER_ADMIN the entire catalog including the platform scope', () => {
    const superAdmin = bundle(RbacRole.SuperAdmin);

    expect(superAdmin.size).toBe(PERMISSION_CATALOG_KEYS.length);
    expect(superAdmin.has(Permission.PlatformAdmin)).toBe(true);
    expect(superAdmin.has(Permission.TeamCreate)).toBe(true);
    expect(superAdmin.has(Permission.TeamBrowseAll)).toBe(true);
  });

  it('withholds every platform permission from the team-scoped bundles', () => {
    const platformScoped: readonly Permission[] = [
      Permission.PlatformAdmin,
      Permission.TeamCreate,
      Permission.TeamBrowseAll,
    ];
    const teamScoped: readonly RbacRole[] = [
      RbacRole.Member,
      RbacRole.Coach,
      RbacRole.TeamAdmin,
      RbacRole.Scorekeeper,
      RbacRole.Analyst,
    ];

    for (const role of teamScoped) {
      for (const permission of platformScoped) {
        expect(bundle(role).has(permission)).toBe(false);
      }
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

  it('composes TEAM_ADMIN as a superset of SCOREKEEPER and ANALYST', () => {
    // The privilege ceiling only lets an actor assign bundles fully contained
    // in their own permissions; a team administrator must be able to assign
    // every team-scoped bundle, including SCOREKEEPER (match.score).
    const teamAdmin = bundle(RbacRole.TeamAdmin);

    for (const permission of bundle(RbacRole.Scorekeeper)) {
      expect(teamAdmin.has(permission)).toBe(true);
    }
    for (const permission of bundle(RbacRole.Analyst)) {
      expect(teamAdmin.has(permission)).toBe(true);
    }
  });
});
