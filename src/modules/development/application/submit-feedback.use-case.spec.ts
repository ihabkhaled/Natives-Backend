import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CoachFeedbackNotFoundError } from '../errors/coach-feedback-not-found.error';
import { FeedbackInvalidTransitionError } from '../errors/feedback-invalid-transition.error';
import { FeedbackVersionConflictError } from '../errors/feedback-version-conflict.error';
import { FeedbackStatus } from '../model/feedback.enums';
import type { CoachFeedback } from '../model/feedback.types';
import { SubmitFeedbackUseCase } from './submit-feedback.use-case';

const NOW = new Date('2026-03-01T00:00:00.000Z');
const actor = { userId: 'coach-1' } as never;

function feedback(status: FeedbackStatus): CoachFeedback {
  return {
    id: 'fb-1',
    familyId: 'fb-1',
    teamId: 'team-1',
    seasonId: null,
    membershipId: 'mem-1',
    authorUserId: 'coach-1',
    status,
    revision: 1,
    recordVersion: 1,
    positiveFrisbee: null,
    frisbeeImprovement: null,
    positiveMental: null,
    mentalImprovement: null,
    teamRole: null,
    recommendedPosition: null,
    summary: null,
    coachNote: null,
    submittedAt: null,
    submittedBy: null,
    publishedAt: null,
    publishedBy: null,
    supersededAt: null,
    supersededById: null,
    createdBy: 'coach-1',
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function build(current: CoachFeedback, authorThrows = false) {
  const tx = {} as never;
  const unitOfWork = {
    runInTransaction: vi.fn((cb: (t: never) => unknown) => cb(tx)),
  };
  const clock = { now: vi.fn(() => NOW) };
  const lookup = {
    requireForWrite: vi.fn(() => current),
    requireAuthor: vi.fn(() => {
      if (authorThrows) {
        throw new CoachFeedbackNotFoundError();
      }
    }),
  };
  const repository = {
    applyTransition: vi.fn(() => feedback(FeedbackStatus.InReview)),
  };
  const audit = { record: vi.fn() };
  const useCase = new SubmitFeedbackUseCase(
    unitOfWork as never,
    clock as never,
    lookup as never,
    repository as never,
    audit as never,
  );
  return { lookup, repository, audit, useCase };
}

function run(harness: ReturnType<typeof build>) {
  return harness.useCase.execute(actor, 'team-1', 'fb-1', {
    expectedRecordVersion: 1,
  });
}

describe('SubmitFeedbackUseCase', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build(feedback(FeedbackStatus.Draft));
  });

  it('submits a draft and audits', async () => {
    const detail = await run(harness);
    expect(detail.feedback.status).toBe(FeedbackStatus.InReview);
    expect(harness.audit.record).toHaveBeenCalled();
  });

  it('hides another coach’s draft', async () => {
    harness = build(feedback(FeedbackStatus.Draft), true);
    await expect(run(harness)).rejects.toBeInstanceOf(
      CoachFeedbackNotFoundError,
    );
  });

  it('rejects submitting a non-draft', async () => {
    harness = build(feedback(FeedbackStatus.Published));
    await expect(run(harness)).rejects.toBeInstanceOf(
      FeedbackInvalidTransitionError,
    );
  });

  it('surfaces a version conflict', async () => {
    harness = build(feedback(FeedbackStatus.Draft));
    harness.repository.applyTransition.mockReturnValue(null as never);
    await expect(run(harness)).rejects.toBeInstanceOf(
      FeedbackVersionConflictError,
    );
  });
});
