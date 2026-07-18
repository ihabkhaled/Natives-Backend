import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AssessmentDuplicateError } from '../errors/assessment-duplicate.error';
import { AssessmentScopeNotFoundError } from '../errors/assessment-scope-not-found.error';
import { AssessmentValidationError } from '../errors/assessment-validation.error';
import { PlayerAssessmentStatus } from '../model/player-assessments.enums';
import type {
  CreatePlayerAssessmentCommand,
  PlayerAssessment,
  PlayerAssessmentContext,
} from '../model/player-assessments.types';
import { CreatePlayerAssessmentUseCase } from './create-player-assessment.use-case';

const SCOPE = {} as never;
const NOW = new Date('2026-06-01T00:00:00.000Z');
const ACTOR = { userId: 'e1', email: 'e@example.test', roles: [] } as never;

const CONTEXT: PlayerAssessmentContext = {
  templateId: 'tm1',
  seasonId: 's1',
  metrics: [
    {
      metricDefinitionId: 'metric-1',
      required: true,
      minimumValue: 0,
      maximumValue: 5,
    },
  ],
};

const COMMAND: CreatePlayerAssessmentCommand = {
  periodId: 'p1',
  membershipId: 'm1',
  summary: 'note',
  values: [
    {
      metricDefinitionId: 'metric-1',
      numericValue: 4,
      textValue: null,
      note: null,
      confidence: null,
      observationCount: null,
    },
  ],
};

function assessment(): PlayerAssessment {
  return {
    id: 'a1',
    familyId: 'a1',
    teamId: 't1',
    seasonId: 's1',
    periodId: 'p1',
    templateId: 'tm1',
    membershipId: 'm1',
    evaluatorUserId: 'e1',
    status: PlayerAssessmentStatus.Draft,
    revision: 1,
    summary: 'note',
    recordVersion: 1,
    submittedAt: null,
    submittedBy: null,
    reviewedAt: null,
    reviewedBy: null,
    publishedAt: null,
    publishedBy: null,
    supersededAt: null,
    supersededById: null,
    createdBy: 'e1',
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function build() {
  const scope = {
    validate: vi.fn().mockResolvedValue(undefined),
    requireMembership: vi.fn().mockResolvedValue(undefined),
  };
  const repository = {
    loadContext: vi.fn().mockResolvedValue(CONTEXT),
    liveExists: vi.fn().mockResolvedValue(false),
    insertAssessment: vi.fn().mockResolvedValue(assessment()),
    insertValues: vi.fn().mockResolvedValue(undefined),
    findValues: vi.fn().mockResolvedValue([]),
  };
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  const unitOfWork = {
    runInTransaction: vi.fn((op: (s: never) => Promise<unknown>) => op(SCOPE)),
  };
  const idGenerator = { generate: vi.fn().mockReturnValue('a1') };
  const clock = { now: vi.fn().mockReturnValue(NOW) };
  return {
    scope,
    repository,
    audit,
    useCase: new CreatePlayerAssessmentUseCase(
      unitOfWork as never,
      clock as never,
      idGenerator,
      scope as never,
      repository as never,
      audit as never,
    ),
  };
}

describe('CreatePlayerAssessmentUseCase', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('creates a draft, validating scope and membership, then audits', async () => {
    const detail = await harness.useCase.execute(ACTOR, 't1', COMMAND);
    expect(detail.assessment.status).toBe(PlayerAssessmentStatus.Draft);
    expect(harness.scope.requireMembership).toHaveBeenCalledWith(
      SCOPE,
      't1',
      'm1',
    );
    expect(harness.repository.insertAssessment).toHaveBeenCalledTimes(1);
    expect(harness.repository.insertValues).toHaveBeenCalledTimes(1);
    expect(harness.audit.record).toHaveBeenCalledTimes(1);
  });

  it('rejects a period whose published template context is missing', async () => {
    harness.repository.loadContext.mockResolvedValueOnce(null);
    await expect(
      harness.useCase.execute(ACTOR, 't1', COMMAND),
    ).rejects.toBeInstanceOf(AssessmentScopeNotFoundError);
  });

  it('rejects a value that references a metric outside the template', async () => {
    await expect(
      harness.useCase.execute(ACTOR, 't1', {
        ...COMMAND,
        values: [
          {
            metricDefinitionId: 'other',
            numericValue: 1,
            textValue: null,
            note: null,
            confidence: null,
            observationCount: null,
          },
        ],
      }),
    ).rejects.toBeInstanceOf(AssessmentValidationError);
    expect(harness.repository.insertAssessment).not.toHaveBeenCalled();
  });

  it('rejects a duplicate live assessment for the evaluator', async () => {
    harness.repository.liveExists.mockResolvedValueOnce(true);
    await expect(
      harness.useCase.execute(ACTOR, 't1', COMMAND),
    ).rejects.toBeInstanceOf(AssessmentDuplicateError);
    expect(harness.repository.insertAssessment).not.toHaveBeenCalled();
  });
});
