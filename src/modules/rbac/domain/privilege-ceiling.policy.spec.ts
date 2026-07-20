import { describe, expect, it } from 'vitest';

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
