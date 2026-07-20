import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MemberDashboardSignalsService } from './member-dashboard-signals.service';

const PROFILE_ROW = {
  preferred_name: 'Ammar',
  email: 'ammar@example.test',
  phone: null,
  gender: null,
  date_of_birth: null,
  jersey_number: null,
  positions: [],
  avatar_media_id: null,
  updated_at: '2026-07-20T12:00:00.000Z',
};

function build() {
  const scope = { run: vi.fn() };
  const unitOfWork = {
    runInTransaction: vi.fn(async (op: (s: typeof scope) => Promise<unknown>) =>
      op(scope),
    ),
  };
  const repository = {
    countInvitedMembers: vi
      .fn()
      .mockResolvedValue([
        { count: 2, boundary_at: '2026-07-01T00:00:00.000Z' },
      ]),
    findProfileCompleteness: vi.fn().mockResolvedValue([PROFILE_ROW]),
  };
  const service = new MemberDashboardSignalsService(
    unitOfWork as never,
    repository,
  );
  return { repository, scope, service };
}

describe('MemberDashboardSignalsService', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('scores the viewer profile and counts the invited roster', async () => {
    const signals = await harness.service.collect({
      teamId: 'team-1',
      membershipId: 'membership-1',
    });

    expect(signals.profileCompletenessPercent).toBe(25);
    expect(signals.profileAsOf).toEqual(new Date('2026-07-20T12:00:00.000Z'));
    expect(signals.invitedMembers).toEqual({
      count: 2,
      asOf: new Date('2026-07-01T00:00:00.000Z'),
    });
  });

  it('skips the profile read entirely when there is no viewer membership', async () => {
    const signals = await harness.service.collect({
      teamId: 'team-1',
      membershipId: null,
    });

    expect(harness.repository.findProfileCompleteness).not.toHaveBeenCalled();
    expect(signals.profileCompletenessPercent).toBeNull();
    expect(signals.profileAsOf).toBeNull();
  });

  it('reports null, not zero, when nothing is measurable', async () => {
    harness.repository.findProfileCompleteness.mockResolvedValue([]);
    harness.repository.countInvitedMembers.mockResolvedValue([
      { count: 0, boundary_at: null },
    ]);

    const signals = await harness.service.collect({
      teamId: 'team-1',
      membershipId: 'membership-1',
    });

    expect(signals.profileCompletenessPercent).toBeNull();
    expect(signals.invitedMembers.count).toBeNull();
  });
});
