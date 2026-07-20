import { MembershipStatus } from '@modules/members';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DashboardTeamForbiddenError } from '../errors/dashboard-team-forbidden.error';
import { DashboardScopeService } from './dashboard-scope.service';

function context(overrides: Record<string, unknown> = {}) {
  return {
    membershipId: 'membership-1',
    teamId: 'team-1',
    teamSlug: 'natives',
    teamName: 'Natives',
    seasonId: 'season-1',
    seasonSlug: '2026',
    seasonName: 'Season 2026',
    status: MembershipStatus.Active,
    joinedAt: null,
    ...overrides,
  };
}

function build() {
  const memberships = { listForUser: vi.fn().mockResolvedValue([context()]) };
  const service = new DashboardScopeService(memberships as never);
  return { memberships, service };
}

describe('DashboardScopeService', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('defaults to the caller first active membership', async () => {
    expect(await harness.service.resolve('user-1', null)).toEqual({
      teamId: 'team-1',
      seasonId: 'season-1',
      membershipId: 'membership-1',
    });
  });

  it('honours an explicitly requested team the caller belongs to', async () => {
    harness.memberships.listForUser.mockResolvedValue([
      context(),
      context({ membershipId: 'membership-2', teamId: 'team-2' }),
    ]);

    const scope = await harness.service.resolve('user-1', 'team-2');

    expect(scope?.membershipId).toBe('membership-2');
  });

  it('refuses a team the caller has no membership in', async () => {
    await expect(
      harness.service.resolve('user-1', 'team-9'),
    ).rejects.toBeInstanceOf(DashboardTeamForbiddenError);
  });

  it('ignores a non-active membership when choosing a default', async () => {
    harness.memberships.listForUser.mockResolvedValue([
      context({ status: MembershipStatus.Suspended }),
    ]);

    expect(await harness.service.resolve('user-1', null)).toBeNull();
  });

  it('refuses a team where the caller membership is not active', async () => {
    harness.memberships.listForUser.mockResolvedValue([
      context({ status: MembershipStatus.Inactive }),
    ]);

    await expect(
      harness.service.resolve('user-1', 'team-1'),
    ).rejects.toBeInstanceOf(DashboardTeamForbiddenError);
  });

  it('resolves to no scope for a caller with no memberships', async () => {
    harness.memberships.listForUser.mockResolvedValue([]);

    expect(await harness.service.resolve('user-1', null)).toBeNull();
  });
});
