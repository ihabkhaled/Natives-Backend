import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CoachFeedbackNotFoundError } from '../errors/coach-feedback-not-found.error';
import { FeedbackInvalidTransitionError } from '../errors/feedback-invalid-transition.error';
import { FeedbackVersionConflictError } from '../errors/feedback-version-conflict.error';
import { FeedbackStatus } from '../model/feedback.enums';
import type { CoachFeedback } from '../model/feedback.types';
import { UpdateFeedbackUseCase } from './update-feedback.use-case';

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

const FIELDS = {
  positiveFrisbee: null,
  frisbeeImprovement: null,
  positiveMental: null,
  mentalImprovement: null,
  teamRole: null,
  recommendedPosition: null,
  summary: 'edit',
  coachNote: null,
};

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
    updateDraftFields: vi.fn(() => feedback(FeedbackStatus.Draft)),
  };
  const audit = { record: vi.fn() };
  const useCase = new UpdateFeedbackUseCase(
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
    fields: FIELDS,
  });
}

describe('UpdateFeedbackUseCase', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build(feedback(FeedbackStatus.Draft));
  });

  it('updates a draft and audits', async () => {
    const detail = await run(harness);
    expect(harness.repository.updateDraftFields).toHaveBeenCalled();
    expect(harness.audit.record).toHaveBeenCalled();
    expect(detail.acknowledgement).toBeNull();
  });

  it('hides another coach’s draft', async () => {
    harness = build(feedback(FeedbackStatus.Draft), true);
    await expect(run(harness)).rejects.toBeInstanceOf(
      CoachFeedbackNotFoundError,
    );
  });

  it('rejects editing a non-draft record', async () => {
    harness = build(feedback(FeedbackStatus.Published));
    await expect(run(harness)).rejects.toBeInstanceOf(
      FeedbackInvalidTransitionError,
    );
  });

  it('surfaces an optimistic version conflict', async () => {
    harness = build(feedback(FeedbackStatus.Draft));
    harness.repository.updateDraftFields.mockReturnValue(null as never);
    await expect(run(harness)).rejects.toBeInstanceOf(
      FeedbackVersionConflictError,
    );
  });
});
