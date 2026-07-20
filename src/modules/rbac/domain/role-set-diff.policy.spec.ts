import { describe, expect, it } from 'vitest';

import type { RoleAssignment } from '../model/rbac.types';
import { diffTeamRoles } from './role-set-diff.policy';

function assignment(id: string, roleKey: string): RoleAssignment {
  return {
    id,
    userId: 'user-1',
    roleId: `role-${roleKey}`,
    roleKey,
    teamId: 'team-1',
    seasonId: null,
    effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
    effectiveTo: null,
    grantedBy: null,
    revokedAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    version: 1,
  };
}

describe('diffTeamRoles', () => {
  it('grants what is missing and revokes what is no longer wanted', () => {
    const current = [assignment('a1', 'MEMBER'), assignment('a2', 'COACH')];

    const diff = diffTeamRoles(current, ['MEMBER', 'ANALYST']);

    expect(diff.toGrant).toEqual(['ANALYST']);
    expect(diff.toRevoke).toEqual([current[1]]);
  });

  it('leaves an unchanged set completely untouched', () => {
    const current = [assignment('a1', 'MEMBER')];

    const diff = diffTeamRoles(current, ['MEMBER']);

    expect(diff.toGrant).toEqual([]);
    expect(diff.toRevoke).toEqual([]);
  });

  it('revokes everything when the requested set is empty', () => {
    const current = [assignment('a1', 'MEMBER')];

    expect(diffTeamRoles(current, []).toRevoke).toEqual(current);
  });

  it('grants everything when nothing is held yet', () => {
    expect(diffTeamRoles([], ['COACH']).toGrant).toEqual(['COACH']);
  });

  it('collapses a duplicated request into a single grant', () => {
    expect(diffTeamRoles([], ['COACH', 'COACH']).toGrant).toEqual(['COACH']);
  });
});
