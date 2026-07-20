import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PointsScopeNotFoundError } from '../errors/points-scope-not-found.error';
import { PointsValidationError } from '../errors/points-validation.error';
import {
  LeaderboardCohort,
  LeaderboardPeriod,
  LeaderboardTieMode,
} from '../model/leaderboard.enums';
import type { LeaderboardQuery } from '../model/leaderboard.types';
import { LeaderboardQueryService } from './leaderboard-query.service';

const NOW = new Date('2026-07-19T12:00:00.000Z');

function query(overrides: Partial<LeaderboardQuery> = {}): LeaderboardQuery {
  return {
    period: LeaderboardPeriod.AllTime,
    tieMode: LeaderboardTieMode.Competition,
    cohort: LeaderboardCohort.Active,
    seasonId: null,
    category: null,
    limit: 20,
    offset: 0,
    ...overrides,
  };
}

function build() {
  const tx = {} as never;
  const unitOfWork = {
    runInTransaction: vi.fn((op: (scope: never) => unknown) => op(tx)),
  };
  const scope = { validate: vi.fn().mockResolvedValue(undefined) };
  const repository = {
    seasonBounds: vi
      .fn()
      .mockResolvedValue({ startsOn: '2026-03-01', endsOn: '2026-05-31' }),
  };
  const data = {
    collect: vi.fn().mockResolvedValue({
      cohort: [{ membershipId: 'a', status: 'active' }],
      currentTotals: [{ membershipId: 'a', total: 7 }],
      previousTotals: null,
      categoryTotals: [],
      badgeCounts: [],
    }),
  };
  const clock = { now: vi.fn().mockReturnValue(NOW), uptime: vi.fn() };
  const service = new LeaderboardQueryService(
    unitOfWork as never,
    clock,
    scope as never,
    repository as never,
    data as never,
  );
  return { scope, repository, data, service };
}

describe('LeaderboardQueryService', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('validates scope and returns the assembled all-time page', async () => {
    const result = await harness.service.teamLeaderboard('team-1', query());
    expect(harness.scope.validate).toHaveBeenCalledWith(
      expect.anything(),
      'team-1',
      null,
    );
    expect(result.total).toBe(1);
    expect(result.items[0]?.membershipId).toBe('a');
    expect(result.asOf).toBe(NOW);
    expect(harness.repository.seasonBounds).not.toHaveBeenCalled();
  });

  it('resolves the season window from the season bounds', async () => {
    await harness.service.teamLeaderboard(
      'team-1',
      query({ period: LeaderboardPeriod.Season, seasonId: 'season-1' }),
    );
    expect(harness.repository.seasonBounds).toHaveBeenCalledWith(
      expect.anything(),
      'team-1',
      'season-1',
    );
  });

  it('rejects a season leaderboard with no season', async () => {
    await expect(
      harness.service.teamLeaderboard(
        'team-1',
        query({ period: LeaderboardPeriod.Season }),
      ),
    ).rejects.toBeInstanceOf(PointsValidationError);
  });

  it('hides a missing season behind a not-found', async () => {
    harness.repository.seasonBounds.mockResolvedValueOnce(null);
    await expect(
      harness.service.teamLeaderboard(
        'team-1',
        query({ period: LeaderboardPeriod.Season, seasonId: 'gone' }),
      ),
    ).rejects.toBeInstanceOf(PointsScopeNotFoundError);
  });
});
