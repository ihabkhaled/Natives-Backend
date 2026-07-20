import { describe, expect, it } from 'vitest';

import { LeaderboardTieMode, RankMovement } from '../model/leaderboard.enums';
import type { MemberStanding } from '../model/leaderboard.types';
import { rankOf, rankStandings } from './leaderboard-ranking.policy';

function standing(
  membershipId: string,
  total: number,
  previousTotal = 0,
): MemberStanding {
  return {
    membershipId,
    status: 'active',
    total,
    previousTotal,
    badgeCount: 0,
    contributions: [],
  };
}

const RANKED = [
  standing('a', 10),
  standing('c', 10),
  standing('b', 5),
  standing('d', 0),
];

function ranks(tieMode: LeaderboardTieMode): readonly number[] {
  return rankStandings(RANKED, tieMode, false).map(row => row.rank);
}

describe('rankStandings — deterministic display order', () => {
  it('orders by total desc then membership id asc regardless of insert order', () => {
    const permuted = [
      standing('d', 0),
      standing('b', 5),
      standing('c', 10),
      standing('a', 10),
    ];
    const first = rankStandings(RANKED, LeaderboardTieMode.Competition, false);
    const second = rankStandings(
      permuted,
      LeaderboardTieMode.Competition,
      false,
    );
    expect(second).toEqual(first);
    expect(first.map(row => row.membershipId)).toEqual(['a', 'c', 'b', 'd']);
  });
});

describe('rankStandings — tie modes', () => {
  it('competition shares a rank and skips the next (1-1-3-4)', () => {
    expect(ranks(LeaderboardTieMode.Competition)).toEqual([1, 1, 3, 4]);
  });

  it('dense shares a rank and never skips (1-1-2-3)', () => {
    expect(ranks(LeaderboardTieMode.Dense)).toEqual([1, 1, 2, 3]);
  });

  it('ordinal breaks every tie by membership id (1-2-3-4)', () => {
    expect(ranks(LeaderboardTieMode.Ordinal)).toEqual([1, 2, 3, 4]);
  });
});

describe('rankStandings — movement', () => {
  it('has no movement when there is no previous window', () => {
    const rows = rankStandings(RANKED, LeaderboardTieMode.Competition, false);
    expect(rows[0]?.movement).toBe(RankMovement.None);
    expect(rows[0]?.previousRank).toBeNull();
    expect(rows[0]?.rankDelta).toBeNull();
  });

  it('reports up, down, and steady against the previous window', () => {
    const standings = [
      standing('a', 10, 0), // was last, now first -> up
      standing('b', 0, 10), // was first, now last -> down
      standing('c', 5, 5), // unchanged middle -> steady
    ];
    const rows = rankStandings(standings, LeaderboardTieMode.Ordinal, true);
    const byId = new Map(rows.map(row => [row.membershipId, row]));
    expect(byId.get('a')?.movement).toBe(RankMovement.Up);
    expect(byId.get('a')?.previousRank).toBe(3);
    expect(byId.get('a')?.rankDelta).toBe(2);
    expect(byId.get('b')?.movement).toBe(RankMovement.Down);
    expect(byId.get('b')?.previousRank).toBe(1);
    expect(byId.get('b')?.rankDelta).toBe(-2);
    expect(byId.get('c')?.movement).toBe(RankMovement.Steady);
    expect(byId.get('c')?.rankDelta).toBe(0);
  });
});

describe('rankOf', () => {
  it('is 1 for an empty cohort target under every mode', () => {
    const only = standing('x', 3);
    for (const mode of [
      LeaderboardTieMode.Competition,
      LeaderboardTieMode.Dense,
      LeaderboardTieMode.Ordinal,
    ]) {
      expect(rankOf([only], only, mode, s => s.total)).toBe(1);
    }
  });
});
