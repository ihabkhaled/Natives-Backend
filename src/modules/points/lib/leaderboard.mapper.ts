import {
  ACTIVE_COHORT_STATUS,
  ADJUSTMENT_CONTRIBUTION_CATEGORY,
  DEFAULT_LEADERBOARD_COHORT,
  DEFAULT_LEADERBOARD_PERIOD,
  DEFAULT_LEADERBOARD_TIE_MODE,
  INACTIVE_COHORT_STATUS,
  LEADERBOARD_CATEGORY_MAX_LENGTH,
  SUSPENDED_COHORT_STATUS,
} from '../model/leaderboard.constants';
import { LeaderboardCohort } from '../model/leaderboard.enums';
import type {
  CohortMember,
  LeaderboardQuery,
  LeaderboardQueryInput,
  MemberBadgeCount,
  MemberCategoryTotal,
  MemberTotal,
  SeasonBounds,
} from '../model/leaderboard.types';
import type {
  CohortMemberRow,
  MemberBadgeCountRow,
  MemberCategoryTotalRow,
  MemberTotalRow,
  SeasonBoundsRow,
} from '../model/points.rows';
import { resolvePointsPage } from './points.helpers';

export function toCohortMember(row: CohortMemberRow): CohortMember {
  return { membershipId: row.membership_id, status: row.status };
}

export function toMemberTotal(row: MemberTotalRow): MemberTotal {
  return {
    membershipId: row.membership_id,
    total: row.total === null ? 0 : Number(row.total),
  };
}

export function toMemberCategoryTotal(
  row: MemberCategoryTotalRow,
): MemberCategoryTotal {
  return {
    membershipId: row.membership_id,
    category: row.activity_category ?? ADJUSTMENT_CONTRIBUTION_CATEGORY,
    total: row.total === null ? 0 : Number(row.total),
  };
}

export function toMemberBadgeCount(row: MemberBadgeCountRow): MemberBadgeCount {
  return {
    membershipId: row.membership_id,
    badgeCount: Number(row.badge_count),
  };
}

export function toSeasonBounds(row: SeasonBoundsRow): SeasonBounds {
  return { startsOn: row.starts_on, endsOn: row.ends_on };
}

/**
 * The membership statuses a cohort filter admits, or null when the cohort admits
 * every non-deleted membership (`all`). Kept as an explicit branch per cohort so a
 * new cohort never silently defaults to a wrong status set.
 */
export function cohortStatuses(
  cohort: LeaderboardCohort,
): readonly string[] | null {
  if (cohort === LeaderboardCohort.Active) {
    return [ACTIVE_COHORT_STATUS];
  }
  if (cohort === LeaderboardCohort.Inactive) {
    return [INACTIVE_COHORT_STATUS];
  }
  if (cohort === LeaderboardCohort.Suspended) {
    return [SUSPENDED_COHORT_STATUS];
  }
  return null;
}

/**
 * Resolve the transport query into a domain query: apply the module defaults for
 * the window/tie/cohort, normalise the optional season and category filters to
 * null, and clamp pagination to the module's bounded window.
 */
export function resolveLeaderboardQuery(
  input: LeaderboardQueryInput,
): LeaderboardQuery {
  const page = resolvePointsPage(input.limit, input.offset);
  return {
    period: input.period ?? DEFAULT_LEADERBOARD_PERIOD,
    tieMode: input.tieMode ?? DEFAULT_LEADERBOARD_TIE_MODE,
    cohort: input.cohort ?? DEFAULT_LEADERBOARD_COHORT,
    seasonId: input.seasonId ?? null,
    category: normaliseCategory(input.category),
    limit: page.limit,
    offset: page.offset,
  };
}

function normaliseCategory(category: string | undefined): string | null {
  if (category === undefined) {
    return null;
  }
  return category.slice(0, LEADERBOARD_CATEGORY_MAX_LENGTH);
}
