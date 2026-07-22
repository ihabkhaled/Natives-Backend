import { ROLE_BUNDLES } from '@shared/constants';
import { RbacRole } from '@shared/enums';
import { describe, expect, it } from 'vitest';

import type { RoleBundleRecord } from '../model/rbac.types';
import {
  isWithinPrivilegeCeiling,
  selectAssignableRoles,
} from './privilege-ceiling.policy';

describe('isWithinPrivilegeCeiling', () => {
  it('is true when the actor holds every target permission', () => {
    const actor = new Set<string>([
      'team.read',
      'member.list',
      'member.invite',
    ]);

    expect(isWithinPrivilegeCeiling(actor, ['team.read', 'member.list'])).toBe(
      true,
    );
  });

  it('is false when the actor lacks any target permission', () => {
    const actor = new Set<string>(['team.read']);

    expect(
      isWithinPrivilegeCeiling(actor, ['team.read', 'member.invite']),
    ).toBe(false);
  });

  it('is true for an empty target set', () => {
    expect(isWithinPrivilegeCeiling(new Set<string>(), [])).toBe(true);
  });
});

describe('selectAssignableRoles', () => {
  const bundles = [
    { roleKey: 'MEMBER', permissions: ['team.read'] },
    { roleKey: 'COACH', permissions: ['team.read', 'practice.manage'] },
    { roleKey: 'TEAM_ADMIN', permissions: ['team.settings.manage'] },
  ];

  it('keeps only the bundles fully contained in the actor permissions', () => {
    const actor = new Set(['team.read', 'practice.manage']);

    expect(selectAssignableRoles(bundles, actor)).toEqual(['MEMBER', 'COACH']);
  });

  it('returns nothing when the actor holds no permissions at all', () => {
    expect(selectAssignableRoles(bundles, new Set())).toEqual([]);
  });

  it('returns nothing for an empty catalog', () => {
    expect(selectAssignableRoles([], new Set(['team.read']))).toEqual([]);
  });
});

describe('selectAssignableRoles against the seeded catalog', () => {
  const catalog: readonly RoleBundleRecord[] = [...ROLE_BUNDLES.entries()].map(
    ([roleKey, permissions]) => ({ roleKey, permissions }),
  );

  function assignableFor(role: RbacRole): readonly string[] {
    const held = new Set<string>(ROLE_BUNDLES.get(role) ?? []);
    return [...selectAssignableRoles(catalog, held)].sort();
  }

  // Regression pin for the runtime-audited defect: SCOREKEEPER was missing
  // from the Team Admin's assignable list because TEAM_ADMIN lacked
  // match.score. The full per-role ceiling is pinned so any bundle edit that
  // silently narrows an assignable set fails here first.
  it('lets a team admin assign every team-scoped bundle including SCOREKEEPER', () => {
    expect(assignableFor(RbacRole.TeamAdmin)).toEqual([
      RbacRole.Analyst,
      RbacRole.Coach,
      RbacRole.Member,
      RbacRole.Scorekeeper,
      RbacRole.TeamAdmin,
    ]);
  });

  it('lets the super admin assign every bundle', () => {
    expect(assignableFor(RbacRole.SuperAdmin)).toEqual(
      [...ROLE_BUNDLES.keys()].sort(),
    );
  });

  it('limits a coach to the MEMBER and COACH bundles', () => {
    expect(assignableFor(RbacRole.Coach)).toEqual([
      RbacRole.Coach,
      RbacRole.Member,
    ]);
  });

  it('limits the standalone bundles to themselves', () => {
    expect(assignableFor(RbacRole.Member)).toEqual([RbacRole.Member]);
    expect(assignableFor(RbacRole.Scorekeeper)).toEqual([RbacRole.Scorekeeper]);
    expect(assignableFor(RbacRole.Analyst)).toEqual([RbacRole.Analyst]);
  });
});
