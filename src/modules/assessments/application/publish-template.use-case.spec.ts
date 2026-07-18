import { RbacRole } from '@shared/enums';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AssessmentTemplateLockedError } from '../errors/assessment-template-locked.error';
import { AssessmentTemplateNotFoundError } from '../errors/assessment-template-not-found.error';
import { AssessmentVersionConflictError } from '../errors/assessment-version-conflict.error';
import { AssessmentTemplateStatus } from '../model/assessments.enums';
import type { AssessmentTemplate } from '../model/assessments.types';
import { PublishTemplateUseCase } from './publish-template.use-case';

const SCOPE = {} as never;
const NOW = new Date('2026-06-01T12:00:00.000Z');
const ACTOR = {
  userId: 'actor-1',
  email: 'a@example.test',
  roles: [],
} as never;
const COMMAND = { expectedRecordVersion: 1 };

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
    status: AssessmentTemplateStatus.Draft,
    version: 1,
    recordVersion: 1,
    publishedAt: null,
    publishedBy: null,
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
    publishTemplate: vi.fn().mockResolvedValue(
      template({
        status: AssessmentTemplateStatus.Published,
        publishedAt: NOW,
        publishedBy: 'actor-1',
        recordVersion: 2,
      }),
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
    useCase: new PublishTemplateUseCase(
      unitOfWork as never,
      clock as never,
      catalog as never,
      audit as never,
    ),
  };
}

describe('PublishTemplateUseCase', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('publishes a draft, locking it, and audits it', async () => {
    const published = await harness.useCase.execute(
      ACTOR,
      'team-1',
      'template-1',
      COMMAND,
    );
    expect(published.status).toBe(AssessmentTemplateStatus.Published);
    expect(harness.audit.record).toHaveBeenCalledTimes(1);
  });

  it('rejects publishing an unknown template', async () => {
    harness.catalog.findTemplateForWrite.mockResolvedValueOnce(null);
    await expect(
      harness.useCase.execute(ACTOR, 'team-1', 'missing', COMMAND),
    ).rejects.toBeInstanceOf(AssessmentTemplateNotFoundError);
  });

  it('refuses to republish an already-published (locked) version', async () => {
    harness.catalog.findTemplateForWrite.mockResolvedValueOnce(
      template({ status: AssessmentTemplateStatus.Published }),
    );
    await expect(
      harness.useCase.execute(ACTOR, 'team-1', 'template-1', COMMAND),
    ).rejects.toBeInstanceOf(AssessmentTemplateLockedError);
    expect(harness.catalog.publishTemplate).not.toHaveBeenCalled();
  });

  it('reports a stale record version as a conflict', async () => {
    harness.catalog.publishTemplate.mockResolvedValueOnce(null);
    await expect(
      harness.useCase.execute(ACTOR, 'team-1', 'template-1', COMMAND),
    ).rejects.toBeInstanceOf(AssessmentVersionConflictError);
    expect(harness.audit.record).not.toHaveBeenCalled();
  });
});
