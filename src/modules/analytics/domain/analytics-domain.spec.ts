import { describe, expect, it } from 'vitest';

import { AnalyticsDimension } from '../model/analytics.enums';
import type {
  AnalyticsProjection,
  AttendanceFact,
} from '../model/analytics.types';
import {
  averageOf,
  maximumOf,
  measureAttendance,
  measureConsistency,
  measurePoints,
  minimumOf,
} from './analytics-computation.policy';
import {
  buildCohortComparison,
  meetsPrivacyThreshold,
  suppressed,
} from './analytics-privacy.policy';
import {
  isStale,
  latestComputedAt,
  summarizeSeries,
  toSeriesPoints,
} from './analytics-series.policy';

const NOW = new Date('2025-03-01T00:00:00.000Z');

function projection(
  overrides: Partial<AnalyticsProjection>,
): AnalyticsProjection {
  return {
    projectionId: 'p-1',
    teamId: 'team-1',
    seasonId: null,
    subjectType: 'player' as AnalyticsProjection['subjectType'],
    subjectId: 'member-1',
    dimension: AnalyticsDimension.Attendance,
    periodType: 'monthly' as AnalyticsProjection['periodType'],
    periodKey: '2025-01',
    value: 0.8,
    sampleSize: 5,
    unit: 'ratio' as AnalyticsProjection['unit'],
    direction: 'higher_better' as AnalyticsProjection['direction'],
    calculationVersion: 'analytics-v1',
    sourceCoverage: {},
    computedAt: NOW,
    ...overrides,
  };
}

describe('analytics computation policy', () => {
  it('measures attendance as a ratio, null when nothing was recorded', () => {
    const measured: AttendanceFact = {
      membershipId: 'm-1',
      periodKey: '2025-01',
      attended: 4,
      total: 5,
    };
    expect(measureAttendance(measured).ratio).toBe(0.8);
    const absent: AttendanceFact = {
      membershipId: 'm-1',
      periodKey: '2025-02',
      attended: 0,
      total: 0,
    };
    expect(measureAttendance(absent).ratio).toBeNull();
    const recordedButNone: AttendanceFact = {
      membershipId: 'm-1',
      periodKey: '2025-03',
      attended: 0,
      total: 3,
    };
    expect(measureAttendance(recordedButNone).ratio).toBe(0);
  });

  it('measures consistency across evaluated periods only', () => {
    const measures = [
      { membershipId: 'm-1', periodKey: '1', ratio: 0.9, sampleSize: 5 },
      { membershipId: 'm-1', periodKey: '2', ratio: 0.5, sampleSize: 5 },
      { membershipId: 'm-1', periodKey: '3', ratio: null, sampleSize: 0 },
    ];
    expect(measureConsistency(measures, 0.7)).toBe(0.5);
    expect(measureConsistency([], 0.7)).toBeNull();
  });

  it('keeps points a real value and computes aggregates', () => {
    expect(
      measurePoints({ membershipId: 'm-1', periodKey: '1', total: 0 }),
    ).toBe(0);
    expect(averageOf([1, null, 3])).toBe(2);
    expect(averageOf([null])).toBeNull();
    expect(minimumOf([3, 1, 2])).toBe(1);
    expect(maximumOf([3, 1, 2])).toBe(3);
    expect(minimumOf([null])).toBeNull();
    expect(maximumOf([null])).toBeNull();
  });
});

describe('analytics privacy policy', () => {
  it('exposes a cohort only above the threshold', () => {
    expect(meetsPrivacyThreshold(5)).toBe(true);
    expect(meetsPrivacyThreshold(4)).toBe(false);
    const big = buildCohortComparison(
      AnalyticsDimension.Attendance,
      '2025-01',
      [0.8, 0.7, 0.9, 0.6, 0.5],
    );
    expect(big.suppressed).toBe(false);
    expect(big.average).toBeCloseTo(0.7);
    const small = buildCohortComparison(
      AnalyticsDimension.Attendance,
      '2025-01',
      [0.8, 0.7],
    );
    expect(small.suppressed).toBe(true);
    expect(small.average).toBeNull();
    expect(small.sampleSize).toBe(2);
  });

  it('suppresses null-only cohorts', () => {
    expect(
      buildCohortComparison(AnalyticsDimension.Points, '2025-01', [null, null])
        .suppressed,
    ).toBe(true);
    expect(
      suppressed(AnalyticsDimension.Points, '2025-01', 0).average,
    ).toBeNull();
  });
});

describe('analytics series policy', () => {
  it('preserves null gaps and orders by period', () => {
    const points = toSeriesPoints([
      projection({ periodKey: '2025-02', value: null }),
      projection({ periodKey: '2025-01', value: 0.8 }),
    ]);
    expect(points.map(p => p.periodKey)).toEqual(['2025-01', '2025-02']);
    expect(points[1]?.value).toBeNull();
  });

  it('summarizes present points and reports empty series', () => {
    expect(
      summarizeSeries([
        { periodKey: '1', value: 0.8, sampleSize: 5 },
        { periodKey: '2', value: 0.6, sampleSize: 4 },
      ]),
    ).toContain('2 evaluated');
    expect(
      summarizeSeries([{ periodKey: '1', value: null, sampleSize: 0 }]),
    ).toContain('No evaluated');
  });

  it('reports the latest computed instant and staleness', () => {
    const later = new Date('2025-03-05T00:00:00.000Z');
    expect(
      latestComputedAt([
        projection({ computedAt: NOW }),
        projection({ computedAt: later }),
      ]),
    ).toBe(later);
    expect(latestComputedAt([])).toBeNull();
    expect(isStale(null, NOW)).toBe(true);
    expect(isStale(NOW, new Date('2025-03-03T00:00:00.000Z'))).toBe(true);
    expect(isStale(NOW, new Date('2025-03-01T06:00:00.000Z'))).toBe(false);
  });
});
