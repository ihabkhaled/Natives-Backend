import { RbacRole } from '@shared/enums';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AssessmentDuplicateError } from '../errors/assessment-duplicate.error';
import { AssessmentValidationError } from '../errors/assessment-validation.error';
import type {
  AssessmentTemplate,
  CreateTemplateCommand,
} from '../model/assessments.types';
import { CreateTemplateUseCase } from './create-template.use-case';

const SCOPE = {} as never;
const NOW = new Date('2026-06-01T12:00:00.000Z');
const ACTOR = {
  userId: 'actor-1',
  email: 'a@example.test',
  roles: [],
} as never;

const COMMAND: CreateTemplateCommand = {
  key: 'midseason',
  seasonId: null,
  name: 'Midseason review',
  cohort: null,
  evaluatorRoles: [RbacRole.Coach],
  scoreVersion: 1,
  categoryWeights: [
    { categoryId: 'category-1', weightPercentage: 60 },
    { categoryId: 'category-2', weightPercentage: 40 },
  ],
  metrics: [{ metricDefinitionId: 'metric-1', required: true, sortOrder: 0 }],
};

function template(): AssessmentTemplate {
  return {
    id: 'template-1',
    familyId: 'template-1',
    teamId: 'team-1',
    seasonId: null,
    key: 'midseason',
    name: 'Midseason review',
    cohort: null,
    evaluatorRoles: [RbacRole.Coach],
    scoreVersion: 1,
    status: 'draft' as never,
    version: 1,
    recordVersion: 1,
    publishedAt: null,
    publishedBy: null,
    createdBy: 'actor-1',
    createdAt: NOW,
    categoryWeights: COMMAND.categoryWeights,
    metrics: COMMAND.metrics,
  };
}

function build() {
  const catalog = {
    templateReferencesExist: vi.fn().mockResolvedValue(true),
    templateKeyExists: vi.fn().mockResolvedValue(false),
    insertTemplate: vi.fn().mockResolvedValue(template()),
  };
  const scope = { validate: vi.fn().mockResolvedValue(undefined) };
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  const unitOfWork = {
    runInTransaction: vi.fn((operation: (s: never) => Promise<unknown>) =>
      operation(SCOPE),
    ),
  };
  const idGenerator = { generate: vi.fn().mockReturnValue('template-1') };
  const clock = { now: vi.fn().mockReturnValue(NOW) };
  return {
    catalog,
    scope,
    audit,
    useCase: new CreateTemplateUseCase(
      unitOfWork as never,
      clock as never,
      idGenerator,
      scope as never,
      catalog as never,
      audit as never,
    ),
  };
}

describe('CreateTemplateUseCase', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('creates a draft version 1 with weights and metrics, then audits it', async () => {
    const created = await harness.useCase.execute(ACTOR, 'team-1', COMMAND);
    expect(created.version).toBe(1);
    const inserted = harness.catalog.insertTemplate.mock.calls[0]?.[1];
    expect(inserted).toMatchObject({
      id: 'template-1',
      familyId: 'template-1',
    });
    expect(harness.catalog.insertTemplate.mock.calls[0]?.[2]).toBe(
      COMMAND.categoryWeights,
    );
    expect(harness.audit.record).toHaveBeenCalledTimes(1);
  });

  it('rejects weights that do not total 100 before any write', async () => {
    await expect(
      harness.useCase.execute(ACTOR, 'team-1', {
        ...COMMAND,
        categoryWeights: [{ categoryId: 'category-1', weightPercentage: 50 }],
      }),
    ).rejects.toBeInstanceOf(AssessmentValidationError);
    expect(harness.scope.validate).not.toHaveBeenCalled();
  });

  it('rejects unknown category or metric references', async () => {
    harness.catalog.templateReferencesExist.mockResolvedValueOnce(false);
    await expect(
      harness.useCase.execute(ACTOR, 'team-1', COMMAND),
    ).rejects.toBeInstanceOf(AssessmentValidationError);
  });

  it('rejects a duplicate template key', async () => {
    harness.catalog.templateKeyExists.mockResolvedValueOnce(true);
    await expect(
      harness.useCase.execute(ACTOR, 'team-1', COMMAND),
    ).rejects.toBeInstanceOf(AssessmentDuplicateError);
    expect(harness.audit.record).not.toHaveBeenCalled();
  });
});
