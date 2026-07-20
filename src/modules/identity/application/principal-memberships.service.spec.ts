import { MembershipStatus } from '@modules/members';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PrincipalMembershipsService } from './principal-memberships.service';

const NOW = new Date('2026-07-20T12:00:00.000Z');

const CONTEXT = {
  membershipId: 'membership-1',
  teamId: 'team-1',
  teamSlug: 'natives',
  teamName: 'Natives',
  seasonId: null,
  seasonSlug: null,
  seasonName: null,
  status: MembershipStatus.Active,
  joinedAt: NOW,
};

function build() {
  const memberships = { listForUser: vi.fn().mockResolvedValue([CONTEXT]) };
  const assignments = { listLiveForUser: vi.fn().mockResolvedValue([]) };
  const service = new PrincipalMembershipsService(
    memberships as never,
    assignments as never,
  );
  return { assignments, memberships, service };
}

describe('PrincipalMembershipsService', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('projects the caller own memberships with their live roles', async () => {
    harness.assignments.listLiveForUser.mockResolvedValue([
      {
        id: 'a1',
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
      },
    ]);

    const payloads = await harness.service.resolve('user-1');

    expect(payloads).toHaveLength(1);
    expect(payloads[0]?.roles).toEqual(['coach']);
    expect(harness.memberships.listForUser).toHaveBeenCalledWith('user-1');
  });

  it('skips the role read entirely when there are no memberships', async () => {
    harness.memberships.listForUser.mockResolvedValue([]);

    expect(await harness.service.resolve('user-1')).toEqual([]);
    expect(harness.assignments.listLiveForUser).not.toHaveBeenCalled();
  });
});
