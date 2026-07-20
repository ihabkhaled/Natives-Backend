import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LeaderboardCohort } from '../model/leaderboard.enums';
import type { PeriodWindow } from '../model/leaderboard.types';
import { LeaderboardRepository } from './leaderboard.repository';

function harness() {
  const run = vi.fn().mockResolvedValue([]);
  const scope = { run } as never;
  const repository = new LeaderboardRepository();
  return { run, scope, repository };
}

const BOUNDED: PeriodWindow = {
  startUtc: new Date('2026-07-01T00:00:00.000Z'),
  endUtc: new Date('2026-08-01T00:00:00.000Z'),
};
const UNBOUNDED: PeriodWindow = { startUtc: null, endUtc: null };

describe('LeaderboardRepository', () => {
  let h: ReturnType<typeof harness>;

  beforeEach(() => {
    h = harness();
  });

  it('scans a bounded cohort filtered by the status the cohort admits', async () => {
    h.run.mockResolvedValueOnce([{ membership_id: 'm1', status: 'active' }]);
    const members = await h.repository.cohortMembers(
      h.scope,
      'team-1',
      LeaderboardCohort.Active,
    );
    expect(members).toEqual([{ membershipId: 'm1', status: 'active' }]);
    const params = h.run.mock.calls[0]?.[1] as unknown[];
    expect(params[1]).toEqual(['active']);
    expect(String(h.run.mock.calls[0]?.[0])).toContain('LIMIT $3');
  });

  it('passes a null status filter for the all cohort', async () => {
    await h.repository.cohortMembers(h.scope, 'team-1', LeaderboardCohort.All);
    const params = h.run.mock.calls[0]?.[1] as unknown[];
    expect(params[1]).toBeNull();
  });

  it('binds a bounded window as ISO instants and an unbounded window as null', async () => {
    await h.repository.windowTotals(h.scope, 'team-1', BOUNDED, 'throwing');
    const bounded = h.run.mock.calls[0]?.[1] as unknown[];
    expect(bounded[1]).toBe('2026-07-01T00:00:00.000Z');
    expect(bounded[2]).toBe('2026-08-01T00:00:00.000Z');
    expect(bounded[3]).toBe('throwing');

    await h.repository.windowTotals(h.scope, 'team-1', UNBOUNDED, null);
    const unbounded = h.run.mock.calls[1]?.[1] as unknown[];
    expect(unbounded[1]).toBeNull();
    expect(unbounded[2]).toBeNull();
    expect(unbounded[3]).toBeNull();
  });

  it('sums totals coalescing a null aggregate to zero', async () => {
    h.run.mockResolvedValueOnce([
      { membership_id: 'm1', total: '12' },
      { membership_id: 'm2', total: null },
    ]);
    const totals = await h.repository.windowTotals(
      h.scope,
      'team-1',
      BOUNDED,
      null,
    );
    expect(totals).toEqual([
      { membershipId: 'm1', total: 12 },
      { membershipId: 'm2', total: 0 },
    ]);
  });

  it('groups category totals within the window', async () => {
    h.run.mockResolvedValueOnce([
      { membership_id: 'm1', activity_category: 'gym', total: '2' },
    ]);
    const totals = await h.repository.categoryTotals(
      h.scope,
      'team-1',
      BOUNDED,
      null,
    );
    expect(totals).toEqual([{ membershipId: 'm1', category: 'gym', total: 2 }]);
  });

  it('counts badges per member', async () => {
    h.run.mockResolvedValueOnce([{ membership_id: 'm1', badge_count: 3 }]);
    const counts = await h.repository.badgeCounts(h.scope, 'team-1');
    expect(counts).toEqual([{ membershipId: 'm1', badgeCount: 3 }]);
  });

  it('reads season bounds or null when the season is absent', async () => {
    h.run.mockResolvedValueOnce([
      { starts_on: '2026-03-01', ends_on: '2026-05-31' },
    ]);
    expect(await h.repository.seasonBounds(h.scope, 'team-1', 's1')).toEqual({
      startsOn: '2026-03-01',
      endsOn: '2026-05-31',
    });
    h.run.mockResolvedValueOnce([]);
    expect(await h.repository.seasonBounds(h.scope, 'team-1', 's1')).toBeNull();
  });
});
