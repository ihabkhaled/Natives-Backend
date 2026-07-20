import { assembleLeaderboard } from '@modules/points/lib/leaderboard.assembler';
import {
  LeaderboardCohort,
  LeaderboardPeriod,
  LeaderboardTieMode,
} from '@modules/points/model/leaderboard.enums';
import type {
  CohortMember,
  LeaderboardData,
  LeaderboardQuery,
  MemberTotal,
} from '@modules/points/model/leaderboard.types';
import { describe, expect, it } from 'vitest';

/**
 * GOLDEN leaderboard tests. The ranking is exercised through the real assembler so
 * the pinned outputs prove the deterministic tie-break (permuted insert order →
 * identical ranks) and zero-contribution inclusion (a cohort member with no ledger
 * rows appears with a measured 0 and a real rank — never omitted, never a null).
 */

const NOW = new Date('2026-07-19T12:00:00.000Z');

function query(tieMode: LeaderboardTieMode): LeaderboardQuery {
  return {
    period: LeaderboardPeriod.AllTime,
    tieMode,
    cohort: LeaderboardCohort.Active,
    seasonId: null,
    category: null,
    limit: 100,
    offset: 0,
  };
}

function data(
  cohort: readonly CohortMember[],
  currentTotals: readonly MemberTotal[],
): LeaderboardData {
  return {
    cohort,
    currentTotals,
    previousTotals: null,
    categoryTotals: [],
    badgeCounts: [],
  };
}

const COHORT: readonly CohortMember[] = [
  { membershipId: 'a', status: 'active' },
  { membershipId: 'b', status: 'active' },
  { membershipId: 'c', status: 'active' },
  { membershipId: 'z', status: 'active' },
];

const TOTALS: readonly MemberTotal[] = [
  { membershipId: 'a', total: 10 },
  { membershipId: 'b', total: 10 },
  { membershipId: 'c', total: 4 },
];

describe('golden: tie-break determinism', () => {
  it('produces identical ranks regardless of insert order', () => {
    const forward = assembleLeaderboard(
      data(COHORT, TOTALS),
      query(LeaderboardTieMode.Competition),
      NOW,
    );
    const reversed = assembleLeaderboard(
      data([...COHORT].reverse(), [...TOTALS].reverse()),
      query(LeaderboardTieMode.Competition),
      NOW,
    );
    expect(reversed.items).toEqual(forward.items);
    expect(forward.items.map(row => [row.membershipId, row.rank])).toEqual([
      ['a', 1],
      ['b', 1],
      ['c', 3],
      ['z', 4],
    ]);
  });
});

describe('golden: zero-contribution inclusion', () => {
  it('ranks a member with no ledger rows with a measured zero total', () => {
    const result = assembleLeaderboard(
      data(COHORT, TOTALS),
      query(LeaderboardTieMode.Competition),
      NOW,
    );
    const z = result.items.find(row => row.membershipId === 'z');
    expect(z?.total).toBe(0);
    expect(z?.rank).toBe(4);
    expect(result.items).toHaveLength(4);
  });
});
