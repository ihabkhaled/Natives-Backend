import { rankStandings } from '../domain/leaderboard-ranking.policy';
import type {
  CategoryContribution,
  LeaderboardData,
  LeaderboardQuery,
  LeaderboardResult,
  MemberBadgeCount,
  MemberCategoryTotal,
  MemberStanding,
  MemberTotal,
} from '../model/leaderboard.types';

/**
 * Pure assembly of the ranked leaderboard page from the fetched aggregates. Every
 * cohort member is included — a member with no in-window rows appears with a
 * measured total of 0 (zero-contribution inclusion, never a null-to-zero guess of
 * unknown data). Standings are ranked by the deterministic policy, then the
 * bounded page is sliced from the fully ranked cohort so ranks and deltas are
 * correct across pages.
 */
export function assembleLeaderboard(
  data: LeaderboardData,
  query: LeaderboardQuery,
  now: Date,
): LeaderboardResult {
  const standings = toMemberStandings(data);
  const ranked = rankStandings(
    standings,
    query.tieMode,
    data.previousTotals !== null,
  );
  return {
    items: ranked.slice(query.offset, query.offset + query.limit),
    total: standings.length,
    limit: query.limit,
    offset: query.offset,
    period: query.period,
    tieMode: query.tieMode,
    cohort: query.cohort,
    category: query.category,
    asOf: now,
  };
}

export function toMemberStandings(
  data: LeaderboardData,
): readonly MemberStanding[] {
  const current = indexTotals(data.currentTotals);
  const previous = indexTotals(data.previousTotals ?? []);
  const badges = indexBadges(data.badgeCounts);
  const contributions = indexContributions(data.categoryTotals);
  return data.cohort.map(member => ({
    membershipId: member.membershipId,
    status: member.status,
    total: current.get(member.membershipId) ?? 0,
    previousTotal: previous.get(member.membershipId) ?? 0,
    badgeCount: badges.get(member.membershipId) ?? 0,
    contributions: contributions.get(member.membershipId) ?? [],
  }));
}

function indexTotals(
  rows: readonly MemberTotal[],
): ReadonlyMap<string, number> {
  const map = new Map<string, number>();
  for (const row of rows) {
    map.set(row.membershipId, row.total);
  }
  return map;
}

function indexBadges(
  rows: readonly MemberBadgeCount[],
): ReadonlyMap<string, number> {
  const map = new Map<string, number>();
  for (const row of rows) {
    map.set(row.membershipId, row.badgeCount);
  }
  return map;
}

function indexContributions(
  rows: readonly MemberCategoryTotal[],
): ReadonlyMap<string, CategoryContribution[]> {
  const map = new Map<string, CategoryContribution[]>();
  for (const row of rows) {
    const list = map.get(row.membershipId) ?? [];
    list.push({ category: row.category, points: row.total });
    map.set(row.membershipId, list);
  }
  for (const list of map.values()) {
    list.sort((a, b) => (a.category < b.category ? -1 : 1));
  }
  return map;
}
