import {
  LeaderboardCohort,
  LeaderboardPeriod,
  LeaderboardTieMode,
} from './leaderboard.enums';

/**
 * The wall-clock timezone every leaderboard window boundary is derived in before
 * being stored/compared as a UTC instant. Africa/Cairo is the product default.
 */
export const LEADERBOARD_TIME_ZONE = 'Africa/Cairo';

/**
 * The day a weekly window starts on, as a `Date.getUTCDay()` index (0=Sunday …
 * 6=Saturday). Weeks start on Monday, so the current week is [Monday 00:00 Cairo,
 * next Monday 00:00 Cairo).
 */
export const WEEK_START_DOW = 1;

/** Days in one leaderboard week — the width of a weekly window. */
export const DAYS_PER_WEEK = 7;

/** Months in a year — used to roll a monthly window across the year boundary. */
export const MONTHS_PER_YEAR = 12;

/**
 * The hard upper bound on how many cohort members a single leaderboard read
 * scans and ranks. Ranking needs the whole cohort to assign correct ranks and
 * deltas, so the scan is bounded here (never an unbounded export) and the page is
 * then sliced from the ranked result.
 */
export const LEADERBOARD_COHORT_MAX = 1000;

/** Default scope applied when the caller omits a filter. */
export const DEFAULT_LEADERBOARD_PERIOD = LeaderboardPeriod.AllTime;
export const DEFAULT_LEADERBOARD_TIE_MODE = LeaderboardTieMode.Competition;
export const DEFAULT_LEADERBOARD_COHORT = LeaderboardCohort.Active;

/**
 * The category key a ledger entry with no activity category (a manual or import
 * adjustment) contributes under in a row's explanation. Distinct from any real
 * activity category so adjustments are transparent, never silently merged.
 */
export const ADJUSTMENT_CONTRIBUTION_CATEGORY = 'adjustment';

/** The single membership status the active cohort filter admits. */
export const ACTIVE_COHORT_STATUS = 'active';
export const INACTIVE_COHORT_STATUS = 'inactive';
export const SUSPENDED_COHORT_STATUS = 'suspended';

/** The leaderboard sub-route param naming a category filter in OpenAPI. */
export const LEADERBOARD_CATEGORY_MIN_LENGTH = 2;
export const LEADERBOARD_CATEGORY_MAX_LENGTH = 50;
