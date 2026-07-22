import { describe, expect, it } from 'vitest';

import {
  AnalyticsDimension,
  AnalyticsDirection,
  AnalyticsPeriodType,
  AnalyticsSubjectType,
  AnalyticsUnit,
} from '../model/analytics.enums';
import type { ProjectionRow } from '../model/analytics.rows';
import type { AnalyticsScope } from '../model/analytics.types';
import {
  buildPlayerProjection,
  buildRebuildAudit,
  buildTeamProjection,
} from './analytics.builders';
import {
  directionOf,
  parseEnumValue,
  resolveAnalyticsPage,
  toCoverage,
  toDate,
  toNullableNumber,
  toNumber,
  unitOf,
} from './analytics.helpers';
import { toProjection } from './analytics.mapper';
import {
  toCohortComparisonQuery,
  toSeriesQuery,
} from './analytics-command.mapper';

const NOW = new Date('2025-03-01T00:00:00.000Z');
const SCOPE: AnalyticsScope = { teamId: 'team-1', seasonId: 'season-1' };

const ROW: ProjectionRow = {
  id: 'p-1',
  team_id: 'team-1',
  season_id: 'season-1',
  subject_type: 'player',
  subject_id: 'member-1',
  dimension: 'attendance',
  period_type: 'monthly',
  period_key: '2025-01',
  value: '0.8',
  sample_size: '5',
  unit: 'ratio',
  direction: 'higher_better',
  calculation_version: 'analytics-v1',
  source_coverage: { attendance: 5, bad: 'x' },
  computed_at: NOW,
  created_at: NOW,
  updated_at: NOW,
};

describe('analytics helpers', () => {
  it('clamps paging and coerces driver values', () => {
    expect(resolveAnalyticsPage(undefined, undefined)).toEqual({
      limit: 30,
      offset: 0,
    });
    expect(resolveAnalyticsPage(999, 3)).toEqual({ limit: 366, offset: 3 });
    expect(toDate(NOW)).toBe(NOW);
    expect(toNumber('4')).toBe(4);
    expect(toNullableNumber(null)).toBeNull();
    expect(parseEnumValue(['a'], 'a', 'x')).toBe('a');
    expect(() => parseEnumValue(['a'], 'z', 'x')).toThrow(/x/u);
  });

  it('resolves dimension unit and direction with neutral defaults', () => {
    expect(unitOf(AnalyticsDimension.Attendance)).toBe(AnalyticsUnit.Ratio);
    expect(unitOf(AnalyticsDimension.Technical)).toBe(AnalyticsUnit.Count);
    expect(directionOf(AnalyticsDimension.Attendance)).toBe(
      AnalyticsDirection.HigherBetter,
    );
    expect(directionOf(AnalyticsDimension.Technical)).toBe(
      AnalyticsDirection.Neutral,
    );
  });

  it('narrows a jsonb coverage column, dropping non-numeric entries', () => {
    expect(toCoverage({ a: 3, b: 'x' })).toEqual({ a: 3 });
    expect(toCoverage('nope')).toEqual({});
  });
});

describe('analytics mapper', () => {
  it('maps a projection, keeping a null value null', () => {
    const projection = toProjection(ROW);
    expect(projection.value).toBe(0.8);
    expect(projection.dimension).toBe(AnalyticsDimension.Attendance);
    expect(projection.sourceCoverage).toEqual({ attendance: 5 });
    expect(toProjection({ ...ROW, value: null }).value).toBeNull();
  });
});

describe('analytics command mapper', () => {
  it('defaults a series query to monthly attendance', () => {
    expect(toSeriesQuery({})).toEqual({
      dimension: AnalyticsDimension.Attendance,
      periodType: AnalyticsPeriodType.Monthly,
    });
    expect(
      toCohortComparisonQuery({
        dimension: AnalyticsDimension.Points,
        periodKey: '2025-01',
      }).periodType,
    ).toBe(AnalyticsPeriodType.Monthly);
  });
});

describe('analytics builders', () => {
  it('builds a player projection, passing null through', () => {
    const projection = buildPlayerProjection(
      'id-1',
      SCOPE,
      'member-1',
      AnalyticsDimension.Attendance,
      AnalyticsPeriodType.Monthly,
      '2025-01',
      null,
      0,
      { attendance: 0 },
      NOW,
    );
    expect(projection.subjectType).toBe(AnalyticsSubjectType.Player);
    expect(projection.value).toBeNull();
    expect(projection.unit).toBe(AnalyticsUnit.Ratio);
  });

  it('builds a team projection with a null subject', () => {
    const projection = buildTeamProjection(
      'id-1',
      SCOPE,
      AnalyticsDimension.RosterCoverage,
      AnalyticsPeriodType.Season,
      '2025',
      0.9,
      12,
      {},
      NOW,
    );
    expect(projection.subjectType).toBe(AnalyticsSubjectType.Team);
    expect(projection.subjectId).toBeNull();
  });

  it('audits a rebuild with reconciliation totals', () => {
    const audit = buildRebuildAudit('user-1', SCOPE, {
      seasonId: 'season-1',
      periodType: AnalyticsPeriodType.Monthly,
      calculationVersion: 'analytics-v1',
      subjectsProjected: 10,
      projectionsWritten: 20,
      computedAt: NOW,
    });
    expect(audit.diff['projectionsWritten']).toBe(20);
  });
});
