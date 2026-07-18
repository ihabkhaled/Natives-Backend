import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AssessmentMetricInUseError } from '../errors/assessment-metric-in-use.error';
import { AssessmentMetricNotFoundError } from '../errors/assessment-metric-not-found.error';
import { AssessmentVersionConflictError } from '../errors/assessment-version-conflict.error';
import { AssessmentDirection } from '../model/assessments.enums';
import type { AssessmentMetric } from '../model/assessments.types';
import { ArchiveMetricUseCase } from './archive-metric.use-case';

const SCOPE = {} as never;
const NOW = new Date('2026-06-01T12:00:00.000Z');
const ACTOR = {
  userId: 'actor-1',
  email: 'a@example.test',
  roles: [],
} as never;
const COMMAND = { expectedRecordVersion: 1 };

function metric(overrides: Partial<AssessmentMetric> = {}): AssessmentMetric {
  return {
    id: 'metric-1',
    familyId: 'family-1',
    teamId: 'team-1',
    categoryId: 'category-1',
    scaleId: 'scale-1',
    key: 'custom_speed',
    name: 'Custom speed',
    definition: 'Observed acceleration',
    direction: AssessmentDirection.HigherIsBetter,
    guidance: 'Observe in games',
    applicability: ['player'],
    tags: ['physical'],
    status: 'active' as never,
    version: 1,
    recordVersion: 1,
    createdBy: 'actor-1',
    archivedBy: null,
    createdAt: NOW,
    archivedAt: null,
    ...overrides,
  };
}

function build() {
  const catalog = {
    findMetricForWrite: vi.fn().mockResolvedValue(metric()),
    metricInUse: vi.fn().mockResolvedValue(false),
    archiveMetric: vi
      .fn()
      .mockResolvedValue(
        metric({ status: 'archived' as never, recordVersion: 2 }),
      ),
  };
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  const unitOfWork = {
    runInTransaction: vi.fn((operation: (s: never) => Promise<unknown>) =>
      operation(SCOPE),
    ),
  };
  const clock = { now: vi.fn().mockReturnValue(NOW) };
  return {
    catalog,
    audit,
    useCase: new ArchiveMetricUseCase(
      unitOfWork as never,
      clock as never,
      catalog as never,
      audit as never,
    ),
  };
}

describe('ArchiveMetricUseCase', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('archives an unused metric with optimistic locking and audits it', async () => {
    const archived = await harness.useCase.execute(
      ACTOR,
      'team-1',
      'metric-1',
      COMMAND,
    );
    expect(archived.recordVersion).toBe(2);
    expect(harness.catalog.archiveMetric).toHaveBeenCalledWith(
      SCOPE,
      expect.objectContaining({
        id: 'metric-1',
        teamId: 'team-1',
        expectedRecordVersion: 1,
        archivedBy: 'actor-1',
        now: NOW,
      }),
    );
    expect(harness.audit.record).toHaveBeenCalledTimes(1);
  });

  it('rejects archiving an unknown metric', async () => {
    harness.catalog.findMetricForWrite.mockResolvedValueOnce(null);
    await expect(
      harness.useCase.execute(ACTOR, 'team-1', 'missing', COMMAND),
    ).rejects.toBeInstanceOf(AssessmentMetricNotFoundError);
  });

  it('refuses to archive a metric already referenced by a template', async () => {
    harness.catalog.metricInUse.mockResolvedValueOnce(true);
    await expect(
      harness.useCase.execute(ACTOR, 'team-1', 'metric-1', COMMAND),
    ).rejects.toBeInstanceOf(AssessmentMetricInUseError);
    expect(harness.catalog.archiveMetric).not.toHaveBeenCalled();
  });

  it('reports a stale record version as a conflict', async () => {
    harness.catalog.archiveMetric.mockResolvedValueOnce(null);
    await expect(
      harness.useCase.execute(ACTOR, 'team-1', 'metric-1', COMMAND),
    ).rejects.toBeInstanceOf(AssessmentVersionConflictError);
    expect(harness.audit.record).not.toHaveBeenCalled();
  });
});
