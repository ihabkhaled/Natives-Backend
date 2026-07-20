import { describe, expect, it, vi } from 'vitest';

import { DashboardSignalsService } from './dashboard-signals.service';

const SCOPE = {
  teamId: 'team-1',
  seasonId: 'season-1',
  membershipId: 'membership-1',
};

describe('DashboardSignalsService', () => {
  it('collects each source once through its public surface', async () => {
    const practices = { collect: vi.fn().mockResolvedValue('practices') };
    const assessments = { collect: vi.fn().mockResolvedValue('assessments') };
    const points = { standing: vi.fn().mockResolvedValue('points') };
    const members = { collect: vi.fn().mockResolvedValue('members') };
    const service = new DashboardSignalsService(
      practices as never,
      assessments as never,
      points as never,
      members as never,
    );

    const bundle = await service.collect(SCOPE);

    expect(bundle).toEqual({
      practices: 'practices',
      assessments: 'assessments',
      points: 'points',
      members: 'members',
    });
    expect(practices.collect).toHaveBeenCalledExactlyOnceWith(SCOPE);
    expect(assessments.collect).toHaveBeenCalledExactlyOnceWith(SCOPE);
    expect(points.standing).toHaveBeenCalledExactlyOnceWith(SCOPE);
    expect(members.collect).toHaveBeenCalledExactlyOnceWith(SCOPE);
  });
});
