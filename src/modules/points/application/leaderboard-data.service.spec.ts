import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  LeaderboardCohort,
  LeaderboardPeriod,
  LeaderboardTieMode,
} from '../model/leaderboard.enums';
import type {
  LeaderboardQuery,
  LeaderboardWindows,
} from '../model/leaderboard.types';
import { LeaderboardDataService } from './leaderboard-data.service';

const QUERY: LeaderboardQuery = {
  period: LeaderboardPeriod.Monthly,
  tieMode: LeaderboardTieMode.Competition,
  cohort: LeaderboardCohort.Active,
  seasonId: null,
  category: null,
  limit: 20,
  offset: 0,
};

const CURRENT = {
  startUtc: new Date('2026-07-01T00:00:00.000Z'),
  endUtc: new Date('2026-08-01T00:00:00.000Z'),
};

function build() {
  const repository = {
    cohortMembers: vi
      .fn()
      .mockResolvedValue([{ membershipId: 'a', status: 'active' }]),
    windowTotals: vi.fn().mockResolvedValue([{ membershipId: 'a', total: 5 }]),
    categoryTotals: vi.fn().mockResolvedValue([]),
    badgeCounts: vi.fn().mockResolvedValue([]),
  };
  const service = new LeaderboardDataService(repository as never);
  return { repository, service };
}

describe('LeaderboardDataService', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('fetches previous-window totals when a previous window exists', async () => {
    const windows: LeaderboardWindows = {
      current: CURRENT,
      previous: {
        startUtc: new Date('2026-06-01T00:00:00.000Z'),
        endUtc: CURRENT.startUtc,
      },
    };
    const data = await harness.service.collect(
      {} as never,
      'team-1',
      QUERY,
      windows,
    );
    expect(data.previousTotals).not.toBeNull();
    expect(harness.repository.windowTotals).toHaveBeenCalledTimes(2);
  });

  it('leaves previous totals null when there is no previous window', async () => {
    const windows: LeaderboardWindows = { current: CURRENT, previous: null };
    const data = await harness.service.collect(
      {} as never,
      'team-1',
      QUERY,
      windows,
    );
    expect(data.previousTotals).toBeNull();
    expect(harness.repository.windowTotals).toHaveBeenCalledTimes(1);
  });
});
