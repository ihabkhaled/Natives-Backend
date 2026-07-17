import { describe, expect, it } from 'vitest';

import { GrantEffect } from '../model/rbac.enums';
import type { PermissionGrant } from '../model/rbac.types';
import { resolveEffectivePermissions } from './effective-permissions.policy';

const NOW = new Date('2026-06-01T00:00:00.000Z');
const PAST = new Date('2026-01-01T00:00:00.000Z');
const FUTURE = new Date('2026-12-01T00:00:00.000Z');

function allow(
  permission: string,
  overrides: Partial<PermissionGrant> = {},
): PermissionGrant {
  return {
    permission,
    effect: GrantEffect.Allow,
    teamId: null,
    seasonId: null,
    effectiveFrom: PAST,
    effectiveTo: null,
    ...overrides,
  };
}

describe('resolveEffectivePermissions', () => {
  it('unions permissions across multiple in-effect covering grants', () => {
    const result = resolveEffectivePermissions(
      [allow('team.read'), allow('member.list')],
      {},
      NOW,
    );

    expect([...result].sort()).toEqual(['member.list', 'team.read']);
  });

  it('excludes grants outside the request scope', () => {
    const result = resolveEffectivePermissions(
      [allow('team.read', { teamId: 'team-1' }), allow('member.list')],
      { teamId: 'team-2' },
      NOW,
    );

    expect([...result]).toEqual(['member.list']);
  });

  it('excludes grants outside their effective window', () => {
    const result = resolveEffectivePermissions(
      [allow('team.read', { effectiveFrom: FUTURE })],
      {},
      NOW,
    );

    expect(result.size).toBe(0);
  });

  it('lets a deny override win over an allow in the same scope', () => {
    const result = resolveEffectivePermissions(
      [
        allow('match.score'),
        { ...allow('match.score'), effect: GrantEffect.Deny },
      ],
      {},
      NOW,
    );

    expect(result.has('match.score')).toBe(false);
  });

  it('a deny does not remove a differently-scoped allow it does not cover', () => {
    const result = resolveEffectivePermissions(
      [
        allow('match.score', { teamId: 'team-1' }),
        {
          ...allow('match.score', { teamId: 'team-2' }),
          effect: GrantEffect.Deny,
        },
      ],
      { teamId: 'team-1' },
      NOW,
    );

    expect(result.has('match.score')).toBe(true);
  });

  it('is deterministic and order-independent', () => {
    const grants = [allow('b'), allow('a'), allow('b')];

    expect([...resolveEffectivePermissions(grants, {}, NOW)].sort()).toEqual([
      'a',
      'b',
    ]);
  });
});
