import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PointsQueryService } from './points-query.service';

function build() {
  const tx = {} as never;
  const unitOfWork = {
    runInTransaction: vi.fn((op: (scope: never) => unknown) => op(tx)),
  };
  const scope = {
    requireOwnMembership: vi.fn().mockResolvedValue('mem-1'),
    requireMembership: vi.fn().mockResolvedValue(undefined),
  };
  const ledger = {
    leaderboard: vi.fn().mockResolvedValue([{ membershipId: 'a', total: 5 }]),
    countActiveMemberships: vi.fn().mockResolvedValue(3),
  };
  const summary = {
    assemble: vi.fn().mockResolvedValue({ membershipId: 'mem-1', total: 5 }),
  };
  const service = new PointsQueryService(
    unitOfWork as never,
    scope as never,
    ledger as never,
    summary as never,
  );
  return { scope, ledger, summary, service };
}

describe('PointsQueryService', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('resolves the caller membership for the self read', async () => {
    const result = await harness.service.myPoints('team-1', 'user-1');
    expect(harness.scope.requireOwnMembership).toHaveBeenCalledWith(
      expect.anything(),
      'team-1',
      'user-1',
    );
    expect(result.membershipId).toBe('mem-1');
  });

  it('validates the membership for a team member read', async () => {
    await harness.service.memberPoints('team-1', 'mem-1');
    expect(harness.scope.requireMembership).toHaveBeenCalledOnce();
    expect(harness.summary.assemble).toHaveBeenCalledOnce();
  });

  it('pages the leaderboard with the active-membership total', async () => {
    const page = await harness.service.teamLeaderboard('team-1', {
      limit: 20,
      offset: 0,
    });
    expect(page).toEqual({
      items: [{ membershipId: 'a', total: 5 }],
      total: 3,
      limit: 20,
      offset: 0,
    });
  });
});
