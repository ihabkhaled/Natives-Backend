import { describe, expect, it } from 'vitest';

import { ADJUSTMENT_CONTRIBUTION_CATEGORY } from '../model/leaderboard.constants';
import {
  LeaderboardCohort,
  LeaderboardPeriod,
  LeaderboardTieMode,
} from '../model/leaderboard.enums';
import {
  cohortStatuses,
  resolveLeaderboardQuery,
  toCohortMember,
  toMemberBadgeCount,
  toMemberCategoryTotal,
  toMemberTotal,
  toSeasonBounds,
} from './leaderboard.mapper';

describe('row mappers', () => {
  it('maps a cohort member row', () => {
    expect(toCohortMember({ membership_id: 'm1', status: 'active' })).toEqual({
      membershipId: 'm1',
      status: 'active',
    });
  });

  it('coalesces a null windowed total to a measured zero', () => {
    expect(toMemberTotal({ membership_id: 'm1', total: '12' }).total).toBe(12);
    expect(toMemberTotal({ membership_id: 'm1', total: null }).total).toBe(0);
  });

  it('labels a null category as an adjustment and null total as zero', () => {
    expect(
      toMemberCategoryTotal({
        membership_id: 'm1',
        activity_category: 'throwing',
        total: '4',
      }),
    ).toEqual({ membershipId: 'm1', category: 'throwing', total: 4 });
    expect(
      toMemberCategoryTotal({
        membership_id: 'm1',
        activity_category: null,
        total: null,
      }),
    ).toEqual({
      membershipId: 'm1',
      category: ADJUSTMENT_CONTRIBUTION_CATEGORY,
      total: 0,
    });
  });

  it('maps a badge count and season bounds', () => {
    expect(
      toMemberBadgeCount({ membership_id: 'm1', badge_count: '2' }).badgeCount,
    ).toBe(2);
    expect(
      toSeasonBounds({ starts_on: '2026-03-01', ends_on: '2026-05-31' }),
    ).toEqual({ startsOn: '2026-03-01', endsOn: '2026-05-31' });
  });
});

describe('cohortStatuses', () => {
  it('maps each cohort to the statuses it admits, or null for all', () => {
    expect(cohortStatuses(LeaderboardCohort.Active)).toEqual(['active']);
    expect(cohortStatuses(LeaderboardCohort.Inactive)).toEqual(['inactive']);
    expect(cohortStatuses(LeaderboardCohort.Suspended)).toEqual(['suspended']);
    expect(cohortStatuses(LeaderboardCohort.All)).toBeNull();
  });
});

describe('resolveLeaderboardQuery', () => {
  it('applies module defaults and null filters when nothing is supplied', () => {
    expect(resolveLeaderboardQuery({})).toEqual({
      period: LeaderboardPeriod.AllTime,
      tieMode: LeaderboardTieMode.Competition,
      cohort: LeaderboardCohort.Active,
      seasonId: null,
      category: null,
      limit: 20,
      offset: 0,
    });
  });

  it('carries supplied filters and clamps the page', () => {
    const resolved = resolveLeaderboardQuery({
      period: LeaderboardPeriod.Monthly,
      tieMode: LeaderboardTieMode.Dense,
      cohort: LeaderboardCohort.All,
      seasonId: 'season-1',
      category: 'throwing',
      limit: 5000,
      offset: 40,
    });
    expect(resolved.period).toBe(LeaderboardPeriod.Monthly);
    expect(resolved.cohort).toBe(LeaderboardCohort.All);
    expect(resolved.seasonId).toBe('season-1');
    expect(resolved.category).toBe('throwing');
    expect(resolved.limit).toBe(100);
    expect(resolved.offset).toBe(40);
  });
});
