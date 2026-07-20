import { describe, expect, it } from 'vitest';

import {
  LeaderboardCohort,
  LeaderboardPeriod,
  LeaderboardTieMode,
  RankMovement,
} from '../model/leaderboard.enums';
import type {
  LeaderboardData,
  LeaderboardQuery,
} from '../model/leaderboard.types';
import {
  assembleLeaderboard,
  toMemberStandings,
} from './leaderboard.assembler';

const NOW = new Date('2026-07-19T12:00:00.000Z');

function data(previousNull: boolean): LeaderboardData {
  return {
    cohort: [
      { membershipId: 'a', status: 'active' },
      { membershipId: 'b', status: 'active' },
      { membershipId: 'c', status: 'active' },
    ],
    currentTotals: [
      { membershipId: 'a', total: 10 },
      { membershipId: 'b', total: 5 },
    ],
    previousTotals: previousNull ? null : [{ membershipId: 'b', total: 9 }],
    categoryTotals: [
      { membershipId: 'a', category: 'throwing', total: 6 },
      { membershipId: 'a', category: 'gym', total: 4 },
      { membershipId: 'b', category: 'running', total: 5 },
    ],
    badgeCounts: [{ membershipId: 'a', badgeCount: 2 }],
  };
}

function query(overrides: Partial<LeaderboardQuery> = {}): LeaderboardQuery {
  return {
    period: LeaderboardPeriod.Monthly,
    tieMode: LeaderboardTieMode.Competition,
    cohort: LeaderboardCohort.Active,
    seasonId: null,
    category: null,
    limit: 2,
    offset: 0,
    ...overrides,
  };
}

describe('toMemberStandings', () => {
  it('includes a zero-contribution member with an empty explanation', () => {
    const standings = toMemberStandings(data(true));
    const c = standings.find(row => row.membershipId === 'c');
    expect(c?.total).toBe(0);
    expect(c?.badgeCount).toBe(0);
    expect(c?.contributions).toEqual([]);
  });

  it('sorts a member’s category contributions and counts badges', () => {
    const a = toMemberStandings(data(true)).find(
      row => row.membershipId === 'a',
    );
    expect(a?.contributions).toEqual([
      { category: 'gym', points: 4 },
      { category: 'throwing', points: 6 },
    ]);
    expect(a?.badgeCount).toBe(2);
  });
});

describe('assembleLeaderboard', () => {
  it('ranks the whole cohort and returns the first bounded page', () => {
    const result = assembleLeaderboard(data(true), query(), NOW);
    expect(result.total).toBe(3);
    expect(result.items).toHaveLength(2);
    expect(result.items.map(row => row.membershipId)).toEqual(['a', 'b']);
    expect(result.asOf).toBe(NOW);
    expect(result.period).toBe(LeaderboardPeriod.Monthly);
  });

  it('slices a later page from the ranked cohort', () => {
    const result = assembleLeaderboard(data(true), query({ offset: 2 }), NOW);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.membershipId).toBe('c');
    expect(result.items[0]?.total).toBe(0);
  });

  it('reports no movement when the window has no previous period', () => {
    const result = assembleLeaderboard(data(true), query(), NOW);
    expect(result.items[0]?.movement).toBe(RankMovement.None);
  });

  it('reports movement when a previous window is present', () => {
    const result = assembleLeaderboard(data(false), query(), NOW);
    const b = result.items.find(row => row.membershipId === 'b');
    expect(b?.previousRank).toBe(1);
    expect(b?.movement).toBe(RankMovement.Down);
  });
});
