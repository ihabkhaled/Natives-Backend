import type { AuthUserIdentity } from '@core/auth';
import type { ClockPort } from '@core/clock/clock.port';
import type { IdGeneratorPort } from '@core/id-generator/id-generator.port';
import type {
  TransactionScope,
  UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import type { AuditRecorderService } from '@modules/platform';
import { describe, expect, it, vi } from 'vitest';

import { AnalyticsScopeNotFoundError } from '../errors/analytics-scope-not-found.error';
import type { AnalyticsFactRepository } from '../infrastructure/analytics-fact.repository';
import type { ProjectionRepository } from '../infrastructure/projection.repository';
import {
  AnalyticsDimension,
  AnalyticsPeriodType,
} from '../model/analytics.enums';
import type { AnalyticsProjection } from '../model/analytics.types';
import { AnalyticsScopeService } from './analytics-scope.service';
import { AnalyticsSeriesService } from './analytics-series.service';
import { CohortComparisonService } from './cohort-comparison.service';
import { RebuildAnalyticsUseCase } from './rebuild-analytics.use-case';

const NOW = new Date('2025-03-01T00:00:00.000Z');
const TX = { run: vi.fn() } as unknown as TransactionScope;
const UOW: UnitOfWorkPort = { runInTransaction: operation => operation(TX) };
const CLOCK: ClockPort = { now: () => NOW, uptime: () => 0 };
let counter = 0;
const IDS: IdGeneratorPort = {
  generate: () => {
    counter += 1;
    return `generated-${counter}`;
  },
};
const ACTOR: AuthUserIdentity = {
  userId: 'user-1',
  email: 'analyst@example.test',
  roles: [],
};

function projection(
  value: number | null,
  overrides: Partial<AnalyticsProjection> = {},
): AnalyticsProjection {
  return {
    projectionId: 'p-1',
    teamId: 'team-1',
    seasonId: null,
    subjectType: 'player' as AnalyticsProjection['subjectType'],
    subjectId: 'member-1',
    dimension: AnalyticsDimension.Attendance,
    periodType: AnalyticsPeriodType.Monthly,
    periodKey: '2025-01',
    value,
    sampleSize: 5,
    unit: 'ratio' as AnalyticsProjection['unit'],
    direction: 'higher_better' as AnalyticsProjection['direction'],
    calculationVersion: 'analytics-v1',
    sourceCoverage: {},
    computedAt: NOW,
    ...overrides,
  };
}

function factRepo(
  overrides: Record<string, unknown> = {},
): AnalyticsFactRepository {
  return {
    activeTeamExists: vi.fn().mockResolvedValue(true),
    membershipExists: vi.fn().mockResolvedValue(true),
    listRoster: vi.fn().mockResolvedValue(['member-1']),
    listAttendanceFacts: vi.fn().mockResolvedValue([
      {
        membershipId: 'member-1',
        periodKey: '2025-01',
        attended: 4,
        total: 5,
      },
    ]),
    listPointsFacts: vi
      .fn()
      .mockResolvedValue([
        { membershipId: 'member-1', periodKey: '2025-01', total: 12 },
      ]),
    ...overrides,
  };
}

function projectionRepo(
  overrides: Record<string, unknown> = {},
): ProjectionRepository {
  return {
    upsert: vi.fn().mockResolvedValue(projection(0.8)),
    listSeries: vi.fn().mockResolvedValue([projection(0.8)]),
    listCohort: vi.fn().mockResolvedValue([]),
    countForTeam: vi.fn().mockResolvedValue(1),
    ...overrides,
  };
}

function auditStub(): AuditRecorderService {
  return {
    record: vi.fn().mockResolvedValue(undefined),
  } as unknown as AuditRecorderService;
}

describe('AnalyticsScopeService', () => {
  it('hides an archived team and a foreign member as not found', async () => {
    const inactive = new AnalyticsScopeService(
      factRepo({ activeTeamExists: vi.fn().mockResolvedValue(false) }),
    );
    await expect(inactive.requireTeam(TX, 'team-1')).rejects.toBeInstanceOf(
      AnalyticsScopeNotFoundError,
    );
    const missing = new AnalyticsScopeService(
      factRepo({ membershipExists: vi.fn().mockResolvedValue(false) }),
    );
    await expect(
      missing.requireMember(TX, 'team-1', 'member-9'),
    ).rejects.toBeInstanceOf(AnalyticsScopeNotFoundError);
  });
});

describe('AnalyticsSeriesService', () => {
  function build(repo = projectionRepo()) {
    return new AnalyticsSeriesService(
      UOW,
      repo,
      new AnalyticsScopeService(factRepo()),
    );
  }

  it('builds a chart-ready player series with a summary and gaps', async () => {
    const series = await build(
      projectionRepo({
        listSeries: vi
          .fn()
          .mockResolvedValue([
            projection(0.8),
            projection(null, { periodKey: '2025-02' }),
          ]),
      }),
    ).playerSeries(
      'team-1',
      'member-1',
      {
        dimension: AnalyticsDimension.Attendance,
        periodType: AnalyticsPeriodType.Monthly,
      },
      { limit: 30, offset: 0 },
    );
    expect(series.seriesId).toContain('member-1');
    expect(series.points).toHaveLength(2);
    expect(series.points[1]?.value).toBeNull();
    expect(series.summary).toContain('evaluated');
  });

  it('builds a team series', async () => {
    const series = await build().teamSeries(
      'team-1',
      {
        dimension: AnalyticsDimension.Points,
        periodType: AnalyticsPeriodType.Monthly,
      },
      { limit: 30, offset: 0 },
    );
    expect(series.seriesId).toContain('team');
  });
});

describe('CohortComparisonService', () => {
  it('suppresses a small cohort and exposes a large one', async () => {
    const small = new CohortComparisonService(
      UOW,
      projectionRepo({
        listCohort: vi
          .fn()
          .mockResolvedValue([projection(0.8), projection(0.7)]),
      }),
      new AnalyticsScopeService(factRepo()),
    );
    const suppressed = await small.compare('team-1', {
      dimension: AnalyticsDimension.Attendance,
      periodType: AnalyticsPeriodType.Monthly,
      periodKey: '2025-01',
    });
    expect(suppressed.suppressed).toBe(true);
    const big = new CohortComparisonService(
      UOW,
      projectionRepo({
        listCohort: vi
          .fn()
          .mockResolvedValue([
            projection(0.8),
            projection(0.7),
            projection(0.9),
            projection(0.6),
            projection(0.5),
          ]),
      }),
      new AnalyticsScopeService(factRepo()),
    );
    const exposed = await big.compare('team-1', {
      dimension: AnalyticsDimension.Attendance,
      periodType: AnalyticsPeriodType.Monthly,
      periodKey: '2025-01',
    });
    expect(exposed.suppressed).toBe(false);
    expect(exposed.average).toBeCloseTo(0.7);
  });
});

describe('RebuildAnalyticsUseCase', () => {
  it('projects every roster member idempotently and audits', async () => {
    const projections = projectionRepo();
    const audit = auditStub();
    const useCase = new RebuildAnalyticsUseCase(
      UOW,
      CLOCK,
      IDS,
      new AnalyticsScopeService(factRepo()),
      factRepo(),
      projections,
      audit,
    );
    const report = await useCase.execute(ACTOR, 'team-1', {
      seasonId: null,
      periodType: AnalyticsPeriodType.Monthly,
    });
    expect(report.subjectsProjected).toBe(1);
    expect(report.projectionsWritten).toBe(2);
    expect(projections.upsert).toHaveBeenCalledTimes(2);
    expect(audit.record).toHaveBeenCalledTimes(1);
  });

  it('rebuilds with no facts still counting the roster', async () => {
    const useCase = new RebuildAnalyticsUseCase(
      UOW,
      CLOCK,
      IDS,
      new AnalyticsScopeService(factRepo()),
      factRepo({
        listAttendanceFacts: vi.fn().mockResolvedValue([]),
        listPointsFacts: vi.fn().mockResolvedValue([]),
      }),
      projectionRepo(),
      auditStub(),
    );
    const report = await useCase.execute(ACTOR, 'team-1', {
      seasonId: null,
      periodType: AnalyticsPeriodType.Monthly,
    });
    expect(report.subjectsProjected).toBe(1);
    expect(report.projectionsWritten).toBe(0);
  });
});
