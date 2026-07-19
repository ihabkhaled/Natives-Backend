import type { AuthUserIdentity } from '@core/auth';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ActivityInvalidTransitionError } from '../errors/activity-invalid-transition.error';
import { ActivityReviewNoteRequiredError } from '../errors/activity-review-note-required.error';
import { ActivityVersionConflictError } from '../errors/activity-version-conflict.error';
import {
  ACTIVITY_APPROVED_EVENT,
  ACTIVITY_REJECTED_EVENT,
} from '../model/activities.constants';
import { ReviewDecision, SubmissionStatus } from '../model/activity.enums';
import type { ActivitySubmission } from '../model/activity.types';
import { RecordReviewDecisionUseCase } from './record-review-decision.use-case';

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
    applyDecision: vi
      .fn()
      .mockResolvedValue(submission(SubmissionStatus.Approved)),
  };
  const detail = {
    assembleDetail: vi
      .fn()
      .mockResolvedValue({ submission: { status: 'approved' } }),
  };
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  const events = { enqueue: vi.fn().mockResolvedValue(undefined) };
  const award = { awardForApproval: vi.fn().mockResolvedValue(undefined) };
  const useCase = new RecordReviewDecisionUseCase(
    unitOfWork as never,
    clock as never,
    eligibility as never,
    review as never,
    detail as never,
    audit as never,
    events as never,
    award as never,
  );
  return { eligibility, review, detail, audit, events, award, useCase };
}

function command(decision: ReviewDecision, reviewNote: string | null) {
  return { expectedRecordVersion: 1, decision, reviewNote };
}

describe('RecordReviewDecisionUseCase', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('approves and emits ActivityApproved', async () => {
    await harness.useCase.execute(
      ACTOR,
      't1',
      's1',
      command(ReviewDecision.Approve, null),
    );
    expect(harness.audit.record).toHaveBeenCalledOnce();
    expect(harness.events.enqueue.mock.calls[0]?.[1]?.eventType).toBe(
      ACTIVITY_APPROVED_EVENT,
    );
    expect(harness.award.awardForApproval).toHaveBeenCalledOnce();
    expect(harness.award.awardForApproval.mock.calls[0]?.[1]).toMatchObject({
      submissionId: 's1',
      membershipId: 'm1',
      activityTypeId: 'type-1',
    });
  });

  it('rejects with a note and emits ActivityRejected without awarding', async () => {
    harness.review.applyDecision.mockResolvedValue(
      submission(SubmissionStatus.Rejected),
    );
    await harness.useCase.execute(
      ACTOR,
      't1',
      's1',
      command(ReviewDecision.Reject, 'insufficient evidence'),
    );
    expect(harness.events.enqueue.mock.calls[0]?.[1]?.eventType).toBe(
      ACTIVITY_REJECTED_EVENT,
    );
    expect(harness.award.awardForApproval).not.toHaveBeenCalled();
  });

  it('requires a note to reject', async () => {
    await expect(
      harness.useCase.execute(
        ACTOR,
        't1',
        's1',
        command(ReviewDecision.Reject, null),
      ),
    ).rejects.toBeInstanceOf(ActivityReviewNoteRequiredError);
    expect(harness.review.applyDecision).not.toHaveBeenCalled();
  });

  it('rejects an invalid transition', async () => {
    harness.eligibility.requireEligible.mockResolvedValue(
      submission(SubmissionStatus.Approved),
    );
    await expect(
      harness.useCase.execute(
        ACTOR,
        't1',
        's1',
        command(ReviewDecision.Approve, null),
      ),
    ).rejects.toBeInstanceOf(ActivityInvalidTransitionError);
  });

  it('rejects a stale version', async () => {
    harness.review.applyDecision.mockResolvedValue(null);
    await expect(
      harness.useCase.execute(
        ACTOR,
        't1',
        's1',
        command(ReviewDecision.Approve, null),
      ),
    ).rejects.toBeInstanceOf(ActivityVersionConflictError);
    expect(harness.events.enqueue).not.toHaveBeenCalled();
  });
});
