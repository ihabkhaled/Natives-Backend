import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AssessmentMetricNotFoundError } from '../errors/assessment-metric-not-found.error';
import { AssessmentValidationError } from '../errors/assessment-validation.error';
import { AssessmentDirection } from '../model/assessments.enums';
import type {
  AssessmentMetric,
  CreateMetricCommand,
} from '../model/assessments.types';
import { CreateMetricVersionUseCase } from './create-metric-version.use-case';

const SCOPE = {} as never;
const NOW = new Date('2026-06-01T12:00:00.000Z');
const ACTOR = {
  userId: 'actor-1',
  email: 'a@example.test',
  roles: [],
} as never;

const COMMAND: CreateMetricCommand = {
  key: 'custom_speed',
  categoryId: 'category-1',
  scaleId: 'scale-1',
  name: 'Custom speed v2',
  definition: 'Refined acceleration',
  direction: AssessmentDirection.HigherIsBetter,
  guidance: 'Observe in games',
  applicability: ['player'],
  tags: ['physical'],
};

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
    referencesExist: vi.fn().mockResolvedValue(true),
    nextMetricVersion: vi.fn().mockResolvedValue(2),
    insertMetric: vi
      .fn()
      .mockResolvedValue(metric({ id: 'metric-2', version: 2 })),
  };
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  const unitOfWork = {
    runInTransaction: vi.fn((operation: (s: never) => Promise<unknown>) =>
      operation(SCOPE),
    ),
  };
  const idGenerator = { generate: vi.fn().mockReturnValue('metric-2') };
  const clock = { now: vi.fn().mockReturnValue(NOW) };
  return {
    catalog,
    audit,
    useCase: new CreateMetricVersionUseCase(
      unitOfWork as never,
      clock as never,
      idGenerator,
      catalog as never,
      audit as never,
    ),
  };
}

describe('CreateMetricVersionUseCase', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('appends the next version sharing family and key', async () => {
    const created = await harness.useCase.execute(
      ACTOR,
      'team-1',
      'metric-1',
      COMMAND,
    );
    expect(created.version).toBe(2);
    const inserted = harness.catalog.insertMetric.mock.calls[0]?.[1];
    expect(inserted).toMatchObject({
      familyId: 'family-1',
      version: 2,
      id: 'metric-2',
    });
    expect(harness.audit.record).toHaveBeenCalledTimes(1);
  });

  it('rejects a version of an unknown metric', async () => {
    harness.catalog.findMetricForWrite.mockResolvedValueOnce(null);
    await expect(
      harness.useCase.execute(ACTOR, 'team-1', 'missing', COMMAND),
    ).rejects.toBeInstanceOf(AssessmentMetricNotFoundError);
  });

  it('rejects an unknown reference or a mismatched key', async () => {
    harness.catalog.referencesExist.mockResolvedValueOnce(false);
    await expect(
      harness.useCase.execute(ACTOR, 'team-1', 'metric-1', COMMAND),
    ).rejects.toBeInstanceOf(AssessmentValidationError);

    await expect(
      harness.useCase.execute(ACTOR, 'team-1', 'metric-1', {
        ...COMMAND,
        key: 'renamed_key',
      }),
    ).rejects.toBeInstanceOf(AssessmentValidationError);
  });
});
