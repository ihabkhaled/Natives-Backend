import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { describe, expect, it, vi } from 'vitest';

import {
  AnalyticsDimension,
  AnalyticsDirection,
  AnalyticsPeriodType,
  AnalyticsSubjectType,
  AnalyticsUnit,
} from '../model/analytics.enums';
import type { ProjectionRow } from '../model/analytics.rows';
import { AnalyticsFactRepository } from './analytics-fact.repository';
import { ProjectionRepository } from './projection.repository';

const NOW = new Date('2025-03-01T00:00:00.000Z');

const ROW: ProjectionRow = {
  id: 'p-1',
  team_id: 'team-1',
  season_id: null,
  subject_type: 'player',
  subject_id: 'member-1',
  dimension: 'attendance',
  period_type: 'monthly',
  period_key: '2025-01',
  value: 0.8,
  sample_size: 5,
  unit: 'ratio',
  direction: 'higher_better',
  calculation_version: 'analytics-v1',
  source_coverage: {},
  computed_at: NOW,
  created_at: NOW,
  updated_at: NOW,
};

function scopeReturning(...results: unknown[][]): {
  scope: TransactionScope;
  run: ReturnType<typeof vi.fn>;
} {
  const run = vi.fn();
  for (const result of results) {
    run.mockResolvedValueOnce(result);
  }
  run.mockResolvedValue([]);
  return { scope: { run }, run };
}

describe('ProjectionRepository', () => {
  const repository = new ProjectionRepository();
  const upsert = {
    id: 'p-1',
    teamId: 'team-1',
    seasonId: null,
    subjectType: AnalyticsSubjectType.Player,
    subjectId: 'member-1',
    dimension: AnalyticsDimension.Attendance,
    periodType: AnalyticsPeriodType.Monthly,
    periodKey: '2025-01',
    value: 0.8,
    sampleSize: 5,
    unit: AnalyticsUnit.Ratio,
    direction: AnalyticsDirection.HigherBetter,
    calculationVersion: 'analytics-v1',
    sourceCoverage: { attendance: 5 },
    now: NOW,
  };

  it('upserts idempotently on the projection key', async () => {
    const { scope, run } = scopeReturning([ROW]);
    expect((await repository.upsert(scope, upsert)).value).toBe(0.8);
    expect(String(run.mock.calls[0]?.[0])).toContain('ON CONFLICT');
  });

  it('throws when a projection write returns no row', async () => {
    const { scope } = scopeReturning([]);
    await expect(repository.upsert(scope, upsert)).rejects.toThrow(
      /projection write/u,
    );
  });

  it('reads a bounded series and a cohort', async () => {
    const series = scopeReturning([ROW]);
    expect(
      await repository.listSeries(
        series.scope,
        'team-1',
        'player',
        'member-1',
        'attendance',
        'monthly',
        { limit: 999, offset: 0 },
      ),
    ).toHaveLength(1);
    expect(series.run.mock.calls[0]?.[1]).toContain(366);
    const cohort = scopeReturning([ROW]);
    expect(
      await repository.listCohort(
        cohort.scope,
        'team-1',
        'attendance',
        'monthly',
        '2025-01',
      ),
    ).toHaveLength(1);
    const count = scopeReturning([{ count: 3 }]);
    expect(await repository.countForTeam(count.scope, 'team-1')).toBe(3);
  });
});

describe('AnalyticsFactRepository', () => {
  const repository = new AnalyticsFactRepository();

  it('probes team and membership and lists the full roster', async () => {
    const team = scopeReturning([{ id: 'team-1' }]);
    expect(await repository.activeTeamExists(team.scope, 'team-1')).toBe(true);
    const member = scopeReturning([]);
    expect(
      await repository.membershipExists(member.scope, 'team-1', 'member-9'),
    ).toBe(false);
    const roster = scopeReturning([
      { membership_id: 'member-1' },
      { membership_id: 'member-2' },
    ]);
    expect(await repository.listRoster(roster.scope, 'team-1', null)).toEqual([
      'member-1',
      'member-2',
    ]);
    expect(String(roster.run.mock.calls[0]?.[0])).toContain(
      `NOT IN ('archived', 'anonymized')`,
    );
  });

  it('aggregates attendance and points facts into monthly buckets', async () => {
    const attendance = scopeReturning([
      {
        membership_id: 'member-1',
        period_key: '2025-01',
        attended: 4,
        total: 5,
      },
    ]);
    const facts = await repository.listAttendanceFacts(
      attendance.scope,
      'team-1',
      null,
    );
    expect(facts[0]?.attended).toBe(4);
    expect(String(attendance.run.mock.calls[0]?.[0])).toContain(`'YYYY-MM'`);
    const points = scopeReturning([
      { membership_id: 'member-1', period_key: '2025-01', total: 12 },
    ]);
    expect(
      (await repository.listPointsFacts(points.scope, 'team-1', null))[0]
        ?.total,
    ).toBe(12);
  });
});
