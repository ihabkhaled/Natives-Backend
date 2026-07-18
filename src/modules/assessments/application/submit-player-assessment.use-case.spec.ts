import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AssessmentIncompleteError } from '../errors/assessment-incomplete.error';
import { AssessmentVersionConflictError } from '../errors/assessment-version-conflict.error';
import { InvalidAssessmentTransitionError } from '../errors/invalid-assessment-transition.error';
import { PlayerAssessmentStatus } from '../model/player-assessments.enums';
import type {
  PlayerAssessment,
  PlayerAssessmentContext,
} from '../model/player-assessments.types';
import { SubmitPlayerAssessmentUseCase } from './submit-player-assessment.use-case';

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

const MEASURED = [
  {
    metricDefinitionId: 'metric-1',
    numericValue: 4,
    textValue: null,
    note: null,
    confidence: null,
    observationCount: null,
  },
];

const MISSING = [
  {
    metricDefinitionId: 'metric-1',
    numericValue: null,
    textValue: null,
    note: null,
    confidence: null,
    observationCount: null,
  },
];

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
    findValues: vi.fn().mockResolvedValue(MEASURED),
    applyTransition: vi
      .fn()
      .mockResolvedValue(draft(PlayerAssessmentStatus.Submitted)),
  };
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  const events = { enqueue: vi.fn().mockResolvedValue(undefined) };
  const unitOfWork = {
    runInTransaction: vi.fn((op: (s: never) => Promise<unknown>) => op(SCOPE)),
  };
  const clock = { now: vi.fn().mockReturnValue(NOW) };
  return {
    lookup,
    repository,
    audit,
    events,
    useCase: new SubmitPlayerAssessmentUseCase(
      unitOfWork as never,
      clock as never,
      lookup as never,
      repository as never,
      audit as never,
      events as never,
    ),
  };
}

describe('SubmitPlayerAssessmentUseCase', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('submits a complete draft, audits, and enqueues the event', async () => {
    const detail = await harness.useCase.execute(ACTOR, 't1', 'a1', {
      expectedRecordVersion: 1,
    });
    expect(detail.assessment.status).toBe(PlayerAssessmentStatus.Submitted);
    expect(harness.audit.record).toHaveBeenCalledTimes(1);
    expect(harness.events.enqueue).toHaveBeenCalledTimes(1);
  });

  it('blocks submission when a required value is missing (null-not-zero)', async () => {
    harness.repository.findValues.mockResolvedValueOnce(MISSING);
    await expect(
      harness.useCase.execute(ACTOR, 't1', 'a1', { expectedRecordVersion: 1 }),
    ).rejects.toBeInstanceOf(AssessmentIncompleteError);
    expect(harness.events.enqueue).not.toHaveBeenCalled();
  });

  it('rejects submitting a non-draft assessment', async () => {
    harness.lookup.requireForWrite.mockResolvedValueOnce(
      draft(PlayerAssessmentStatus.Submitted),
    );
    await expect(
      harness.useCase.execute(ACTOR, 't1', 'a1', { expectedRecordVersion: 1 }),
    ).rejects.toBeInstanceOf(InvalidAssessmentTransitionError);
  });

  it('surfaces an optimistic version conflict', async () => {
    harness.repository.applyTransition.mockResolvedValueOnce(null);
    await expect(
      harness.useCase.execute(ACTOR, 't1', 'a1', { expectedRecordVersion: 9 }),
    ).rejects.toBeInstanceOf(AssessmentVersionConflictError);
  });
});
