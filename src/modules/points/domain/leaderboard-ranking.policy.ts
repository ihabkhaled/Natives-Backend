import { LeaderboardTieMode, RankMovement } from '../model/leaderboard.enums';
import type {
  MemberStanding,
  RankedLeaderboardRow,
  RankMovementOutcome,
} from '../model/leaderboard.types';

/**
 * The deterministic, side-effect-free leaderboard ranker — the single authority
 * for how a cohort's projected totals become transparent ranks. The display order
 * is always total DESC then membership id ASC, so a permuted insert order yields
 * an identical result. Ranks follow the chosen tie mode: `competition` (1-2-2-4)
 * shares a rank and skips, `dense` (1-2-2-3) never skips, `ordinal` (1-2-3-4)
 * breaks every tie by the same secondary order. Movement compares the current
 * rank to the member's rank over the previous window in the same tie mode; with
 * no previous window every movement is `none`. Every branch is unit-tested.
 */
export function rankStandings(
  standings: readonly MemberStanding[],
  tieMode: LeaderboardTieMode,
  hasPrevious: boolean,
): readonly RankedLeaderboardRow[] {
  const ordered = [...standings].sort(compareByCurrent);
  return ordered.map(standing =>
    toRankedRow(standing, standings, tieMode, hasPrevious),
  );
}

function toRankedRow(
  standing: MemberStanding,
  all: readonly MemberStanding[],
  tieMode: LeaderboardTieMode,
  hasPrevious: boolean,
): RankedLeaderboardRow {
  const rank = rankOf(all, standing, tieMode, currentValue);
  const movement = resolveMovement(all, standing, tieMode, hasPrevious, rank);
  return {
    membershipId: standing.membershipId,
    status: standing.status,
    total: standing.total,
    rank,
    previousRank: movement.previousRank,
    rankDelta: movement.rankDelta,
    movement: movement.movement,
    badgeCount: standing.badgeCount,
    contributions: standing.contributions,
  };
}

function resolveMovement(
  all: readonly MemberStanding[],
  standing: MemberStanding,
  tieMode: LeaderboardTieMode,
  hasPrevious: boolean,
  currentRank: number,
): RankMovementOutcome {
  if (!hasPrevious) {
    return { previousRank: null, rankDelta: null, movement: RankMovement.None };
  }
  const previousRank = rankOf(all, standing, tieMode, previousValue);
  const rankDelta = previousRank - currentRank;
  return { previousRank, rankDelta, movement: movementFor(rankDelta) };
}

/** The 1-based rank of a member within the cohort under a tie mode. */
export function rankOf(
  all: readonly MemberStanding[],
  target: MemberStanding,
  tieMode: LeaderboardTieMode,
  valueOf: (standing: MemberStanding) => number,
): number {
  const value = valueOf(target);
  if (tieMode === LeaderboardTieMode.Ordinal) {
    return 1 + all.filter(member => isBefore(member, target, valueOf)).length;
  }
  if (tieMode === LeaderboardTieMode.Dense) {
    return 1 + distinctGreaterCount(all, value, valueOf);
  }
  return 1 + all.filter(member => valueOf(member) > value).length;
}

function isBefore(
  member: MemberStanding,
  target: MemberStanding,
  valueOf: (standing: MemberStanding) => number,
): boolean {
  const memberValue = valueOf(member);
  const targetValue = valueOf(target);
  if (memberValue !== targetValue) {
    return memberValue > targetValue;
  }
  return member.membershipId < target.membershipId;
}

function distinctGreaterCount(
  all: readonly MemberStanding[],
  value: number,
  valueOf: (standing: MemberStanding) => number,
): number {
  const greater = all
    .filter(member => valueOf(member) > value)
    .map(member => valueOf(member));
  return new Set(greater).size;
}

function movementFor(rankDelta: number): RankMovement {
  if (rankDelta > 0) {
    return RankMovement.Up;
  }
  if (rankDelta < 0) {
    return RankMovement.Down;
  }
  return RankMovement.Steady;
}

function compareByCurrent(a: MemberStanding, b: MemberStanding): number {
  if (b.total !== a.total) {
    return b.total - a.total;
  }
  return a.membershipId < b.membershipId ? -1 : 1;
}

function currentValue(standing: MemberStanding): number {
  return standing.total;
}

function previousValue(standing: MemberStanding): number {
  return standing.previousTotal;
}
