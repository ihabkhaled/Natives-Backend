import type { MembershipContext } from '@modules/members';
import { MembershipStatus } from '@modules/members';
import type { RoleAssignment } from '@modules/rbac';
import { describe, expect, it } from 'vitest';

import { toAuthMembershipPayloads } from './membership-payload.mapper';

const NOW = new Date('2026-07-20T12:00:00.000Z');

const MEMBERSHIP: MembershipContext = {
  membershipId: 'membership-1',
  teamId: 'team-1',
  teamSlug: 'ultimate-natives',
  teamName: 'Ultimate Natives',
  seasonId: 'season-1',
  seasonSlug: '2026',
  seasonName: 'Season 2026',
  status: MembershipStatus.Active,
  joinedAt: NOW,
};

function assignment(overrides: Partial<RoleAssignment> = {}): RoleAssignment {
  return {
    id: 'assignment-1',
    userId: 'user-1',
    roleId: 'role-1',
    roleKey: 'COACH',
    teamId: 'team-1',
    seasonId: null,
    effectiveFrom: NOW,
    effectiveTo: null,
    grantedBy: null,
    revokedAt: null,
    createdAt: NOW,
    version: 1,
    ...overrides,
  };
}

describe('toAuthMembershipPayloads', () => {
  it('projects the membership with the role slugs live in its scope', () => {
    const payloads = toAuthMembershipPayloads(
      [MEMBERSHIP],
      [assignment(), assignment({ id: 'a2', roleKey: 'TEAM_ADMIN' })],
    );

    expect(payloads).toEqual([
      {
        membershipId: 'membership-1',
        teamId: 'team-1',
        teamSlug: 'ultimate-natives',
        teamName: 'Ultimate Natives',
        seasonId: 'season-1',
        seasonSlug: '2026',
        seasonName: 'Season 2026',
        status: MembershipStatus.Active,
        roles: ['coach', 'team_admin'],
      },
    ]);
  });

  it('never attaches another team roles to this membership', () => {
    const payloads = toAuthMembershipPayloads(
      [MEMBERSHIP],
      [assignment({ teamId: 'team-2' })],
    );

    expect(payloads[0]?.roles).toEqual([]);
  });

  it('attaches a global assignment to every membership', () => {
    const payloads = toAuthMembershipPayloads(
      [MEMBERSHIP],
      [assignment({ teamId: null, roleKey: 'MEMBER' })],
    );

    expect(payloads[0]?.roles).toEqual(['member']);
  });

  it('honours a season-bound assignment only inside that season', () => {
    const bound = assignment({ seasonId: 'season-2' });

    expect(toAuthMembershipPayloads([MEMBERSHIP], [bound])[0]?.roles).toEqual(
      [],
    );
  });

  it('de-duplicates repeated role keys and sorts the result', () => {
    const payloads = toAuthMembershipPayloads(
      [MEMBERSHIP],
      [
        assignment({ id: 'a1', roleKey: 'MEMBER' }),
        assignment({ id: 'a2', roleKey: 'MEMBER' }),
        assignment({ id: 'a3', roleKey: 'ANALYST' }),
      ],
    );

    expect(payloads[0]?.roles).toEqual(['analyst', 'member']);
  });

  it('carries a non-active membership through with its real status', () => {
    const suspended: MembershipContext = {
      ...MEMBERSHIP,
      status: MembershipStatus.Suspended,
      seasonId: null,
      seasonSlug: null,
      seasonName: null,
    };

    const payload = toAuthMembershipPayloads([suspended], [])[0];

    expect(payload?.status).toBe(MembershipStatus.Suspended);
    expect(payload?.seasonName).toBeNull();
  });

  it('returns an empty list for a principal with no memberships', () => {
    expect(toAuthMembershipPayloads([], [assignment()])).toEqual([]);
  });
});
