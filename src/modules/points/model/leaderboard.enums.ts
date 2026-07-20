/**
 * Enumerations for the points leaderboard read surface (UN-403). Every enum ships
 * a `*_VALUES` tuple so DTO validation and mappers can check a raw value against
 * the closed set without a hand-maintained second list.
 */

/**
 * The scored window a leaderboard projects over. Weekly and monthly windows are
 * derived from the ledger with Africa/Cairo calendar boundaries (stored UTC);
 * season uses the referenced season's date range; all-time has no bounds. The
 * total is always the sum of the in-scope ledger entries — never a stored counter.
 */
export enum LeaderboardPeriod {
  Weekly = 'weekly',
  Monthly = 'monthly',
  Season = 'season',
  AllTime = 'all_time',
}

export const LEADERBOARD_PERIOD_VALUES: readonly LeaderboardPeriod[] =
  Object.values(LeaderboardPeriod);

/**
 * The documented, deterministic tie method. `competition` (standard 1-2-2-4)
 * gives tied totals the same rank and skips the next; `dense` (1-2-2-3) never
 * skips; `ordinal` breaks every tie by the stable secondary order (membership id
 * ascending). The secondary order is identical across modes, so a permuted insert
 * order always yields the same ranking.
 */
export enum LeaderboardTieMode {
  Competition = 'competition',
  Dense = 'dense',
  Ordinal = 'ordinal',
}

export const LEADERBOARD_TIE_MODE_VALUES: readonly LeaderboardTieMode[] =
  Object.values(LeaderboardTieMode);

/**
 * The cohort completeness filter. `active` (the default) is the eligible current
 * roster; every active member appears even with a zero total. `inactive` and
 * `suspended` expose an explicit historical cohort; `all` includes every
 * non-deleted membership. Inactive players are therefore never silently dropped
 * nor silently included — the caller chooses the cohort.
 */
export enum LeaderboardCohort {
  Active = 'active',
  Inactive = 'inactive',
  Suspended = 'suspended',
  All = 'all',
}

export const LEADERBOARD_COHORT_VALUES: readonly LeaderboardCohort[] =
  Object.values(LeaderboardCohort);

/**
 * A row's rank movement versus the previous comparable period. `up`/`down`/`steady`
 * compare the current rank to the previous-period rank in the same tie mode;
 * `none` means there is no previous period to compare (season and all-time).
 */
export enum RankMovement {
  Up = 'up',
  Down = 'down',
  Steady = 'steady',
  None = 'none',
}

export const RANK_MOVEMENT_VALUES: readonly RankMovement[] =
  Object.values(RankMovement);
