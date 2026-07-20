import type {
  LeaderboardCohort,
  LeaderboardPeriod,
  LeaderboardTieMode,
  RankMovement,
} from './leaderboard.enums';

// --- Query -------------------------------------------------------------------

/**
 * A resolved leaderboard query: the scored window, tie mode, cohort completeness
 * filter, an optional season (required only for the season window), an optional
 * single activity-category filter, and the bounded page. Built from the transport
 * DTO with the module's defaults and clamped pagination applied.
 */
export interface LeaderboardQuery {
  readonly period: LeaderboardPeriod;
  readonly tieMode: LeaderboardTieMode;
  readonly cohort: LeaderboardCohort;
  readonly seasonId: string | null;
  readonly category: string | null;
  readonly limit: number;
  readonly offset: number;
}

// --- Windows -----------------------------------------------------------------

/**
 * A half-open UTC window `[startUtc, endUtc)`. A null bound is unbounded — an
 * all-time leaderboard has both bounds null. Boundaries are always stored UTC
 * instants derived from Africa/Cairo calendar edges.
 */
export interface PeriodWindow {
  readonly startUtc: Date | null;
  readonly endUtc: Date | null;
}

/**
 * The current scored window plus the comparable previous window used for rank
 * movement. `previous` is null when there is nothing to compare against (season
 * and all-time), which resolves every row's movement to `none`.
 */
export interface LeaderboardWindows {
  readonly current: PeriodWindow;
  readonly previous: PeriodWindow | null;
}

/** The Africa/Cairo calendar bounds of a season (inclusive ISO date-only). */
export interface SeasonBounds {
  readonly startsOn: string;
  readonly endsOn: string;
}

// --- Aggregates (repository output) ------------------------------------------

/** A cohort member in scope, with the membership status that admitted it. */
export interface CohortMember {
  readonly membershipId: string;
  readonly status: string;
}

/** A membership's summed points within one window (a projection, never stored). */
export interface MemberTotal {
  readonly membershipId: string;
  readonly total: number;
}

/** A membership's summed points for one category within the current window. */
export interface MemberCategoryTotal {
  readonly membershipId: string;
  readonly category: string;
  readonly total: number;
}

/** A membership's count of earned badges. */
export interface MemberBadgeCount {
  readonly membershipId: string;
  readonly badgeCount: number;
}

/**
 * Everything fetched for the cohort in one transaction before ranking. A null
 * `previousTotals` means the window has no comparable previous period.
 */
export interface LeaderboardData {
  readonly cohort: readonly CohortMember[];
  readonly currentTotals: readonly MemberTotal[];
  readonly previousTotals: readonly MemberTotal[] | null;
  readonly categoryTotals: readonly MemberCategoryTotal[];
  readonly badgeCounts: readonly MemberBadgeCount[];
}

// --- Standings / rows --------------------------------------------------------

/** One category's contribution to a member's window total (the explanation). */
export interface CategoryContribution {
  readonly category: string;
  readonly points: number;
}

/**
 * One member merged from the cohort and the aggregates, before ranking. A
 * zero-contribution member is present with `total` 0. `previousTotal` is 0 when
 * the member scored nothing in the previous window (or there is none — the caller
 * carries `hasPrevious` separately so the zero is never surfaced).
 */
export interface MemberStanding {
  readonly membershipId: string;
  readonly status: string;
  readonly total: number;
  readonly previousTotal: number;
  readonly badgeCount: number;
  readonly contributions: readonly CategoryContribution[];
}

/**
 * A fully ranked, transparent leaderboard row: the projected total, the rank in
 * the chosen tie mode, the previous rank and signed delta (null when there is no
 * previous period), the movement, the badge count, and the per-category
 * explanation of how the total was reached.
 */
export interface RankedLeaderboardRow {
  readonly membershipId: string;
  readonly status: string;
  readonly total: number;
  readonly rank: number;
  readonly previousRank: number | null;
  readonly rankDelta: number | null;
  readonly movement: RankMovement;
  readonly badgeCount: number;
  readonly contributions: readonly CategoryContribution[];
}

/** A member's rank movement versus the previous comparable window. */
export interface RankMovementOutcome {
  readonly previousRank: number | null;
  readonly rankDelta: number | null;
  readonly movement: RankMovement;
}

/**
 * A bounded, ranked leaderboard page that echoes the resolved scope for
 * transparency and carries the freshness instant the projection was read at.
 */
export interface LeaderboardResult {
  readonly items: readonly RankedLeaderboardRow[];
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
  readonly period: LeaderboardPeriod;
  readonly tieMode: LeaderboardTieMode;
  readonly cohort: LeaderboardCohort;
  readonly category: string | null;
  readonly asOf: Date;
}

/** Loosely-typed leaderboard query input the transport DTO satisfies. */
export interface LeaderboardQueryInput {
  readonly period?: LeaderboardPeriod;
  readonly tieMode?: LeaderboardTieMode;
  readonly cohort?: LeaderboardCohort;
  readonly seasonId?: string;
  readonly category?: string;
  readonly limit?: number;
  readonly offset?: number;
}
