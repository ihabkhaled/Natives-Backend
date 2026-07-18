import { RbacRole } from '@shared/enums';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AssessmentTemplateNotFoundError } from '../errors/assessment-template-not-found.error';
import { AssessmentValidationError } from '../errors/assessment-validation.error';
import type {
  AssessmentTemplate,
  CreateTemplateCommand,
} from '../model/assessments.types';
import { CreateTemplateVersionUseCase } from './create-template-version.use-case';

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
  name: 'Midseason review v2',
  cohort: null,
  evaluatorRoles: [RbacRole.Coach],
  scoreVersion: 2,
  categoryWeights: [{ categoryId: 'category-1', weightPercentage: 100 }],
  metrics: [{ metricDefinitionId: 'metric-1', required: true, sortOrder: 0 }],
};

function template(
  overrides: Partial<AssessmentTemplate> = {},
): AssessmentTemplate {
  return {
    id: 'template-1',
    familyId: 'family-1',
    teamId: 'team-1',
    seasonId: null,
    key: 'midseason',
    name: 'Midseason review',
    cohort: null,
    evaluatorRoles: [RbacRole.Coach],
    scoreVersion: 1,
    status: 'published' as never,
    version: 1,
    recordVersion: 1,
    publishedAt: NOW,
    publishedBy: 'actor-1',
    createdBy: 'actor-1',
    createdAt: NOW,
    categoryWeights: [],
    metrics: [],
    ...overrides,
  };
}

function build() {
  const catalog = {
    findTemplateForWrite: vi.fn().mockResolvedValue(template()),
    templateReferencesExist: vi.fn().mockResolvedValue(true),
    nextTemplateVersion: vi.fn().mockResolvedValue(2),
    insertTemplate: vi
      .fn()
      .mockResolvedValue(
        template({ id: 'template-2', version: 2, status: 'draft' as never }),
      ),
  };
  const scope = { validate: vi.fn().mockResolvedValue(undefined) };
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  const unitOfWork = {
    runInTransaction: vi.fn((operation: (s: never) => Promise<unknown>) =>
      operation(SCOPE),
    ),
  };
  const idGenerator = { generate: vi.fn().mockReturnValue('template-2') };
  const clock = { now: vi.fn().mockReturnValue(NOW) };
  return {
    catalog,
    audit,
    useCase: new CreateTemplateVersionUseCase(
      unitOfWork as never,
      clock as never,
      idGenerator,
      scope as never,
      catalog as never,
      audit as never,
    ),
  };
}

describe('CreateTemplateVersionUseCase', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('appends the next draft version sharing family and key', async () => {
    const created = await harness.useCase.execute(
      ACTOR,
      'team-1',
      'template-1',
      COMMAND,
    );
    expect(created.version).toBe(2);
    const inserted = harness.catalog.insertTemplate.mock.calls[0]?.[1];
    expect(inserted).toMatchObject({
      familyId: 'family-1',
      version: 2,
      id: 'template-2',
    });
    expect(harness.audit.record).toHaveBeenCalledTimes(1);
  });

  it('rejects a version of an unknown template', async () => {
    harness.catalog.findTemplateForWrite.mockResolvedValueOnce(null);
    await expect(
      harness.useCase.execute(ACTOR, 'team-1', 'missing', COMMAND),
    ).rejects.toBeInstanceOf(AssessmentTemplateNotFoundError);
  });

  it('rejects invalid weights and mismatched keys', async () => {
    await expect(
      harness.useCase.execute(ACTOR, 'team-1', 'template-1', {
        ...COMMAND,
        categoryWeights: [{ categoryId: 'category-1', weightPercentage: 50 }],
      }),
    ).rejects.toBeInstanceOf(AssessmentValidationError);

    await expect(
      harness.useCase.execute(ACTOR, 'team-1', 'template-1', {
        ...COMMAND,
        key: 'renamed',
      }),
    ).rejects.toBeInstanceOf(AssessmentValidationError);
  });
});
