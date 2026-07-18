import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AssessmentSelfApprovalError } from '../errors/assessment-self-approval.error';
import { AssessmentVersionConflictError } from '../errors/assessment-version-conflict.error';
import { InvalidAssessmentTransitionError } from '../errors/invalid-assessment-transition.error';
import {
  PlayerAssessmentStatus,
  ReviewDecision,
} from '../model/player-assessments.enums';
import type { PlayerAssessment } from '../model/player-assessments.types';
import { ReviewPlayerAssessmentUseCase } from './review-player-assessment.use-case';

const SCOPE = {} as never;
const NOW = new Date('2026-06-01T00:00:00.000Z');
const REVIEWER = { userId: 'r1', email: 'r@example.test', roles: [] } as never;
const EVALUATOR = { userId: 'e1', email: 'e@example.test', roles: [] } as never;

function submitted(
  status = PlayerAssessmentStatus.Submitted,
): PlayerAssessment {
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
    recordVersion: 2,
    submittedAt: NOW,
    submittedBy: 'e1',
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
  const lookup = { requireForWrite: vi.fn().mockResolvedValue(submitted()) };
  const repository = {
    applyTransition: vi
      .fn()
      .mockResolvedValue(submitted(PlayerAssessmentStatus.Approved)),
    findValues: vi.fn().mockResolvedValue([]),
  };
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  const unitOfWork = {
    runInTransaction: vi.fn((op: (s: never) => Promise<unknown>) => op(SCOPE)),
  };
  const clock = { now: vi.fn().mockReturnValue(NOW) };
  return {
    lookup,
    repository,
    audit,
    useCase: new ReviewPlayerAssessmentUseCase(
      unitOfWork as never,
      clock as never,
      lookup as never,
      repository as never,
      audit as never,
    ),
  };
}

describe('ReviewPlayerAssessmentUseCase', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('approves a submitted assessment by an independent reviewer', async () => {
    const detail = await harness.useCase.execute(REVIEWER, 't1', 'a1', {
      decision: ReviewDecision.Approve,
      expectedRecordVersion: 2,
      note: null,
    });
    expect(detail.assessment.status).toBe(PlayerAssessmentStatus.Approved);
    expect(harness.audit.record).toHaveBeenCalledTimes(1);
  });

  it('forbids the evaluator approving their own assessment', async () => {
    await expect(
      harness.useCase.execute(EVALUATOR, 't1', 'a1', {
        decision: ReviewDecision.Approve,
        expectedRecordVersion: 2,
        note: null,
      }),
    ).rejects.toBeInstanceOf(AssessmentSelfApprovalError);
    expect(harness.repository.applyTransition).not.toHaveBeenCalled();
  });

  it('allows the evaluator to reject (reopen) their own submission', async () => {
    harness.repository.applyTransition.mockResolvedValueOnce(
      submitted(PlayerAssessmentStatus.Draft),
    );
    const detail = await harness.useCase.execute(EVALUATOR, 't1', 'a1', {
      decision: ReviewDecision.Reject,
      expectedRecordVersion: 2,
      note: null,
    });
    expect(detail.assessment.status).toBe(PlayerAssessmentStatus.Draft);
  });

  it('rejects an illegal review transition', async () => {
    harness.lookup.requireForWrite.mockResolvedValueOnce(
      submitted(PlayerAssessmentStatus.Published),
    );
    await expect(
      harness.useCase.execute(REVIEWER, 't1', 'a1', {
        decision: ReviewDecision.Approve,
        expectedRecordVersion: 2,
        note: null,
      }),
    ).rejects.toBeInstanceOf(InvalidAssessmentTransitionError);
  });

  it('surfaces an optimistic version conflict', async () => {
    harness.repository.applyTransition.mockResolvedValueOnce(null);
    await expect(
      harness.useCase.execute(REVIEWER, 't1', 'a1', {
        decision: ReviewDecision.Approve,
        expectedRecordVersion: 9,
        note: null,
      }),
    ).rejects.toBeInstanceOf(AssessmentVersionConflictError);
  });
});
