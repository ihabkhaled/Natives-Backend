import type { AuthUserIdentity } from '@core/auth';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ActivityInvalidTransitionError } from '../errors/activity-invalid-transition.error';
import { ActivityVersionConflictError } from '../errors/activity-version-conflict.error';
import { ACTIVITY_CORRECTED_EVENT } from '../model/activities.constants';
import { SubmissionStatus } from '../model/activity.enums';
import type { ActivitySubmission } from '../model/activity.types';
import { CorrectSubmissionUseCase } from './correct-submission.use-case';

const NOW = new Date('2024-06-01T00:00:00.000Z');
const ACTOR: AuthUserIdentity = {
  userId: 'admin',
  email: 'a@x.test',
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
    recordVersion: 3,
    submittedAt: NOW,
    submittedBy: 'member',
    reviewedAt: NOW,
    reviewedBy: 'coach',
    reviewerUserId: 'coach',
    reviewStartedAt: NOW,
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
      .mockResolvedValue(submission(SubmissionStatus.Approved)),
  };
  const review = {
    applyReversal: vi
      .fn()
      .mockResolvedValue(submission(SubmissionStatus.Reversed)),
  };
  const detail = {
    assembleDetail: vi
      .fn()
      .mockResolvedValue({ submission: { status: 'reversed' } }),
  };
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  const events = { enqueue: vi.fn().mockResolvedValue(undefined) };
  const useCase = new CorrectSubmissionUseCase(
    unitOfWork as never,
    clock as never,
    eligibility as never,
    review as never,
    detail as never,
    audit as never,
    events as never,
  );
  return { eligibility, review, detail, audit, events, useCase };
}

const COMMAND = {
  expectedRecordVersion: 3,
  reason: 'duplicate of another claim',
};

describe('CorrectSubmissionUseCase', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('reverses an approved claim and emits ActivityCorrected', async () => {
    await harness.useCase.execute(ACTOR, 't1', 's1', COMMAND);
    expect(harness.audit.record).toHaveBeenCalledOnce();
    expect(harness.events.enqueue.mock.calls[0]?.[1]?.eventType).toBe(
      ACTIVITY_CORRECTED_EVENT,
    );
  });

  it('rejects correcting a non-approved claim', async () => {
    harness.eligibility.requireEligible.mockResolvedValue(
      submission(SubmissionStatus.Submitted),
    );
    await expect(
      harness.useCase.execute(ACTOR, 't1', 's1', COMMAND),
    ).rejects.toBeInstanceOf(ActivityInvalidTransitionError);
    expect(harness.review.applyReversal).not.toHaveBeenCalled();
  });

  it('rejects a stale version', async () => {
    harness.review.applyReversal.mockResolvedValue(null);
    await expect(
      harness.useCase.execute(ACTOR, 't1', 's1', COMMAND),
    ).rejects.toBeInstanceOf(ActivityVersionConflictError);
    expect(harness.events.enqueue).not.toHaveBeenCalled();
  });
});
