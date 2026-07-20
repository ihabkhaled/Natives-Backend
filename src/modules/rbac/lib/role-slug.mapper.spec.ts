import { RbacRole } from '@shared/enums';
import { describe, expect, it } from 'vitest';

import { toRoleKey, toRoleSlug } from './role-slug.mapper';

describe('toRoleSlug', () => {
  it('lowercases a stored role key into the client slug', () => {
    expect(toRoleSlug(RbacRole.TeamAdmin)).toBe('team_admin');
    expect(toRoleSlug(RbacRole.Member)).toBe('member');
  });
});

describe('toRoleKey', () => {
  it.each([
    ['member', RbacRole.Member],
    ['coach', RbacRole.Coach],
    ['team_admin', RbacRole.TeamAdmin],
    ['scorekeeper', RbacRole.Scorekeeper],
    ['analyst', RbacRole.Analyst],
  ])('resolves %s to the seeded catalog key', (slug, expected) => {
    expect(toRoleKey(slug)).toBe(expected);
  });

  it('accepts a slug in any case because the catalog is upper-cased', () => {
    expect(toRoleKey('Team_Admin')).toBe(RbacRole.TeamAdmin);
  });

  it('rejects a value outside the catalog instead of widening the role set', () => {
    expect(toRoleKey('superuser')).toBeNull();
    expect(toRoleKey('')).toBeNull();
  });
});
