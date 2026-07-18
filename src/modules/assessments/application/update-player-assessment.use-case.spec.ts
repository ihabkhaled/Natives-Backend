import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AssessmentVersionConflictError } from '../errors/assessment-version-conflict.error';
import { InvalidAssessmentTransitionError } from '../errors/invalid-assessment-transition.error';
import { PlayerAssessmentStatus } from '../model/player-assessments.enums';
import type {
  PlayerAssessment,
  PlayerAssessmentContext,
  UpdatePlayerAssessmentCommand,
} from '../model/player-assessments.types';
import { UpdatePlayerAssessmentUseCase } from './update-player-assessment.use-case';

const SCOPE = {} as never;
const NOW = new Date('2026-06-01T00:00:00.000Z');
const ACTOR = { userId: 'e1', email: 'e@example.test', roles: [] } as never;

const CONTEXT: PlayerAssessmentContext = {
  templateId: 'tm1',
  seasonId: null,
  metrics: [
    {
      metricDefinitionId: 'metric-1',
      required: true,
      minimumValue: 0,
      maximumValue: 5,
    },
  ],
};

const COMMAND: UpdatePlayerAssessmentCommand = {
  expectedRecordVersion: 1,
  summary: 'updated',
  values: [
    {
      metricDefinitionId: 'metric-1',
      numericValue: null,
      textValue: null,
      note: 'seen little',
      confidence: null,
      observationCount: null,
    },
  ],
};

function draft(status = PlayerAssessmentStatus.Draft): PlayerAssessment {
  return {
    id: 'a1',
    familyId: 'a1',
    teamId: 't1',
    seasonId: null,
    periodId: 'p1',
    templateId: 'tm1',
    membershipId: 'm1',
    evaluatorUserId: 'e1',
    status,
    revision: 1,
    summary: null,
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
  const lookup = {
    requireForWrite: vi.fn().mockResolvedValue(draft()),
    requireOwned: vi.fn(),
  };
  const repository = {
    loadContext: vi.fn().mockResolvedValue(CONTEXT),
    updateDraft: vi.fn().mockResolvedValue(draft()),
    clearValues: vi.fn().mockResolvedValue(undefined),
    insertValues: vi.fn().mockResolvedValue(undefined),
    findValues: vi.fn().mockResolvedValue([]),
  };
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  const unitOfWork = {
    runInTransaction: vi.fn((op: (s: never) => Promise<unknown>) => op(SCOPE)),
  };
  const idGenerator = { generate: vi.fn().mockReturnValue('v1') };
  const clock = { now: vi.fn().mockReturnValue(NOW) };
  return {
    lookup,
    repository,
    audit,
    useCase: new UpdatePlayerAssessmentUseCase(
      unitOfWork as never,
      clock as never,
      idGenerator,
      lookup as never,
      repository as never,
      audit as never,
    ),
  };
}

describe('UpdatePlayerAssessmentUseCase', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('replaces a draft’s values under ownership and audits', async () => {
    await harness.useCase.execute(ACTOR, 't1', 'a1', COMMAND);
    expect(harness.lookup.requireOwned).toHaveBeenCalledTimes(1);
    expect(harness.repository.clearValues).toHaveBeenCalledWith(SCOPE, 'a1');
    expect(harness.repository.insertValues).toHaveBeenCalledTimes(1);
    expect(harness.audit.record).toHaveBeenCalledTimes(1);
  });

  it('rejects editing a non-draft assessment', async () => {
    harness.lookup.requireForWrite.mockResolvedValueOnce(
      draft(PlayerAssessmentStatus.Submitted),
    );
    await expect(
      harness.useCase.execute(ACTOR, 't1', 'a1', COMMAND),
    ).rejects.toBeInstanceOf(InvalidAssessmentTransitionError);
  });

  it('surfaces an optimistic version conflict', async () => {
    harness.repository.updateDraft.mockResolvedValueOnce(null);
    await expect(
      harness.useCase.execute(ACTOR, 't1', 'a1', COMMAND),
    ).rejects.toBeInstanceOf(AssessmentVersionConflictError);
    expect(harness.repository.clearValues).not.toHaveBeenCalled();
  });
});
