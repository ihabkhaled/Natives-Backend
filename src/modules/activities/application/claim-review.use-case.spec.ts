import type { AuthUserIdentity } from '@core/auth';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ActivityInvalidTransitionError } from '../errors/activity-invalid-transition.error';
import { ActivityReviewForbiddenError } from '../errors/activity-review-forbidden.error';
import { ActivityVersionConflictError } from '../errors/activity-version-conflict.error';
import { SubmissionStatus } from '../model/activity.enums';
import type { ActivitySubmission } from '../model/activity.types';
import { ClaimReviewUseCase } from './claim-review.use-case';

const NOW = new Date('2024-06-01T00:00:00.000Z');
const ACTOR: AuthUserIdentity = {
  userId: 'coach',
  email: 'c@x.test',
  roles: [],
};

function submission(status: SubmissionStatus): ActivitySubmission {
  return {
    id: 's1',
    teamId: 't1',
    seasonId: null,
    membershipId: 'm1',
    activityTypeId: 'type-1',
    submitterUserId: 'member',
    status,
    performedOn: '2024-05-30',
    durationMinutes: 60,
    quantity: null,
    notes: null,
    reviewNote: null,
    recordVersion: 1,
    submittedAt: NOW,
    submittedBy: 'member',
    reviewedAt: null,
    reviewedBy: null,
    reviewerUserId: null,
    reviewStartedAt: null,
    reversalReason: null,
    reversedAt: null,
    reversedBy: null,
    withdrawnAt: null,
    createdBy: 'member',
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function build() {
  const tx = {} as never;
  const unitOfWork = {
    runInTransaction: vi.fn((op: (scope: never) => unknown) => op(tx)),
  };
  const clock = { now: vi.fn().mockReturnValue(NOW) };
  const eligibility = {
    requireEligible: vi
      .fn()
      .mockResolvedValue(submission(SubmissionStatus.Submitted)),
  };
  const review = {
    claimForReview: vi
      .fn()
      .mockResolvedValue(submission(SubmissionStatus.UnderReview)),
  };
  const detail = {
    assembleDetail: vi
      .fn()
      .mockResolvedValue({ submission: { status: 'under_review' } }),
  };
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  const useCase = new ClaimReviewUseCase(
    unitOfWork as never,
    clock as never,
    eligibility as never,
    review as never,
    detail as never,
    audit as never,
  );
  return { eligibility, review, detail, audit, useCase };
}

describe('ClaimReviewUseCase', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('claims a submitted claim into review and audits it', async () => {
    const view = await harness.useCase.execute(ACTOR, 't1', 's1', {
      expectedRecordVersion: 1,
    });
    expect(view.submission.status).toBe('under_review');
    expect(harness.audit.record).toHaveBeenCalledOnce();
  });

  it('rejects claiming a non-submitted claim', async () => {
    harness.eligibility.requireEligible.mockResolvedValue(
      submission(SubmissionStatus.UnderReview),
    );
    await expect(
      harness.useCase.execute(ACTOR, 't1', 's1', { expectedRecordVersion: 1 }),
    ).rejects.toBeInstanceOf(ActivityInvalidTransitionError);
  });

  it('rejects a stale version', async () => {
    harness.review.claimForReview.mockResolvedValue(null);
    await expect(
      harness.useCase.execute(ACTOR, 't1', 's1', { expectedRecordVersion: 1 }),
    ).rejects.toBeInstanceOf(ActivityVersionConflictError);
  });

  it('propagates a self/buddy review conflict', async () => {
    harness.eligibility.requireEligible.mockRejectedValue(
      new ActivityReviewForbiddenError(),
    );
    await expect(
      harness.useCase.execute(ACTOR, 't1', 's1', { expectedRecordVersion: 1 }),
    ).rejects.toBeInstanceOf(ActivityReviewForbiddenError);
    expect(harness.review.claimForReview).not.toHaveBeenCalled();
  });
});
