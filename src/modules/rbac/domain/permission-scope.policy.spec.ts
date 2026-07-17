import { describe, expect, it } from 'vitest';

import { GrantEffect } from '../model/rbac.enums';
import type { PermissionGrant } from '../model/rbac.types';
import { grantCoversScope, grantIsInEffect } from './permission-scope.policy';

const BASE = new Date('2026-01-01T00:00:00.000Z');

function grant(overrides: Partial<PermissionGrant>): PermissionGrant {
  return {
    permission: 'team.read',
    effect: GrantEffect.Allow,
    teamId: null,
    seasonId: null,
    effectiveFrom: BASE,
    effectiveTo: null,
    ...overrides,
  };
}

describe('grantCoversScope', () => {
  it('global grant (null team/season) covers any scope', () => {
    expect(grantCoversScope(grant({}), { teamId: 'team-1' })).toBe(true);
    expect(grantCoversScope(grant({}), {})).toBe(true);
  });

  it('team-scoped grant covers only a matching team', () => {
    const g = grant({ teamId: 'team-1' });

    expect(grantCoversScope(g, { teamId: 'team-1' })).toBe(true);
    expect(grantCoversScope(g, { teamId: 'team-2' })).toBe(false);
    expect(grantCoversScope(g, {})).toBe(false);
  });

  it('season-scoped grant covers only a matching season', () => {
    const g = grant({ teamId: 'team-1', seasonId: 'season-1' });

    expect(
      grantCoversScope(g, { teamId: 'team-1', seasonId: 'season-1' }),
    ).toBe(true);
    expect(
      grantCoversScope(g, { teamId: 'team-1', seasonId: 'season-2' }),
    ).toBe(false);
  });
});

describe('grantIsInEffect', () => {
  it('excludes a future grant', () => {
    const g = grant({ effectiveFrom: new Date('2026-02-01T00:00:00.000Z') });

    expect(grantIsInEffect(g, BASE)).toBe(false);
  });

  it('includes an open-ended grant that has started', () => {
    expect(grantIsInEffect(grant({}), BASE)).toBe(true);
  });

  it('includes a grant within its window', () => {
    const g = grant({ effectiveTo: new Date('2026-03-01T00:00:00.000Z') });

    expect(grantIsInEffect(g, new Date('2026-02-01T00:00:00.000Z'))).toBe(true);
  });

  it('excludes an expired grant', () => {
    const g = grant({ effectiveTo: new Date('2026-01-02T00:00:00.000Z') });

    expect(grantIsInEffect(g, new Date('2026-02-01T00:00:00.000Z'))).toBe(
      false,
    );
  });
});
