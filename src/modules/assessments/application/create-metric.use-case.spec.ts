import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AssessmentDuplicateError } from '../errors/assessment-duplicate.error';
import { AssessmentValidationError } from '../errors/assessment-validation.error';
import { AssessmentDirection } from '../model/assessments.enums';
import type {
  AssessmentMetric,
  CreateMetricCommand,
} from '../model/assessments.types';
import { CreateMetricUseCase } from './create-metric.use-case';

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
  name: 'Custom speed',
  definition: 'Observed acceleration',
  direction: AssessmentDirection.HigherIsBetter,
  guidance: 'Observe in games',
  applicability: ['player'],
  tags: ['physical'],
};

function metric(): AssessmentMetric {
  return {
    id: 'metric-1',
    familyId: 'metric-1',
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
  };
}

function build() {
  const catalog = {
    referencesExist: vi.fn().mockResolvedValue(true),
    metricKeyExists: vi.fn().mockResolvedValue(false),
    insertMetric: vi.fn().mockResolvedValue(metric()),
  };
  const scope = { validate: vi.fn().mockResolvedValue(undefined) };
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  const unitOfWork = {
    runInTransaction: vi.fn((operation: (s: never) => Promise<unknown>) =>
      operation(SCOPE),
    ),
  };
  const idGenerator = { generate: vi.fn().mockReturnValue('metric-1') };
  const clock = { now: vi.fn().mockReturnValue(NOW) };
  return {
    catalog,
    scope,
    audit,
    idGenerator,
    useCase: new CreateMetricUseCase(
      unitOfWork as never,
      clock as never,
      idGenerator,
      scope as never,
      catalog as never,
      audit as never,
    ),
  };
}

describe('CreateMetricUseCase', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('appends version 1 with family = the new row and audits it', async () => {
    const created = await harness.useCase.execute(ACTOR, 'team-1', COMMAND);
    expect(created.version).toBe(1);
    expect(harness.scope.validate).toHaveBeenCalledWith(SCOPE, 'team-1', null);
    const inserted = harness.catalog.insertMetric.mock.calls[0]?.[1];
    expect(inserted).toMatchObject({
      id: 'metric-1',
      familyId: 'metric-1',
      teamId: 'team-1',
      version: 1,
      createdBy: 'actor-1',
      now: NOW,
    });
    expect(harness.audit.record).toHaveBeenCalledTimes(1);
  });

  it('rejects an unknown category or scale reference', async () => {
    harness.catalog.referencesExist.mockResolvedValueOnce(false);
    await expect(
      harness.useCase.execute(ACTOR, 'team-1', COMMAND),
    ).rejects.toBeInstanceOf(AssessmentValidationError);
    expect(harness.catalog.insertMetric).not.toHaveBeenCalled();
  });

  it('rejects a duplicate metric key within the team', async () => {
    harness.catalog.metricKeyExists.mockResolvedValueOnce(true);
    await expect(
      harness.useCase.execute(ACTOR, 'team-1', COMMAND),
    ).rejects.toBeInstanceOf(AssessmentDuplicateError);
    expect(harness.audit.record).not.toHaveBeenCalled();
  });
});
