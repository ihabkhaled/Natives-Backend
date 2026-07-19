import type { AuthUserIdentity } from '@core/auth';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ActivityInvalidTransitionError } from '../errors/activity-invalid-transition.error';
import { ActivityVersionConflictError } from '../errors/activity-version-conflict.error';
import { ACTIVITY_WITHDRAWN_EVENT } from '../model/activities.constants';
import { SubmissionStatus } from '../model/activity.enums';
import type { ActivitySubmission } from '../model/activity.types';
import { WithdrawSubmissionUseCase } from './withdraw-submission.use-case';

const NOW = new Date('2024-06-01T00:00:00.000Z');
const ACTOR: AuthUserIdentity = {
  userId: 'u1',
  email: 'p@example.test',
  roles: [],
};

function submission(status: SubmissionStatus): ActivitySubmission {
  return {
    id: 's1',
    teamId: 't1',
    seasonId: null,
    membershipId: 'm1',
    activityTypeId: 'type-1',
    submitterUserId: 'u1',
    status,
    performedOn: '2024-05-30',
    durationMinutes: 60,
    quantity: null,
    notes: null,
    reviewNote: null,
    recordVersion: 1,
    submittedAt: null,
    submittedBy: null,
    reviewedAt: null,
    reviewedBy: null,
    reviewerUserId: null,
    reviewStartedAt: null,
    reversalReason: null,
    reversedAt: null,
    reversedBy: null,
    withdrawnAt: null,
    createdBy: 'u1',
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
  const lookup = {
    requireForWrite: vi
      .fn()
      .mockResolvedValue(submission(SubmissionStatus.Submitted)),
    requireOwner: vi.fn(),
  };
  const submissions = {
    applyStatusChange: vi
      .fn()
      .mockResolvedValue(submission(SubmissionStatus.Withdrawn)),
  };
  const buddies = { listForSubmission: vi.fn().mockResolvedValue([]) };
  const evidence = { countForSubmission: vi.fn().mockResolvedValue(0) };
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  const events = { enqueue: vi.fn().mockResolvedValue(undefined) };
  const useCase = new WithdrawSubmissionUseCase(
    unitOfWork as never,
    clock as never,
    lookup as never,
    submissions as never,
    buddies as never,
    evidence as never,
    audit as never,
    events as never,
  );
  return { lookup, submissions, events, useCase };
}

describe('WithdrawSubmissionUseCase', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('withdraws a non-decided submission and emits ActivityWithdrawn', async () => {
    const detail = await harness.useCase.execute(ACTOR, 't1', 's1', {
      expectedRecordVersion: 1,
    });
    expect(detail.submission.status).toBe(SubmissionStatus.Withdrawn);
    expect(harness.events.enqueue.mock.calls[0]?.[1]?.eventType).toBe(
      ACTIVITY_WITHDRAWN_EVENT,
    );
  });

  it('rejects withdrawing an already-decided submission', async () => {
    harness.lookup.requireForWrite.mockResolvedValue(
      submission(SubmissionStatus.Approved),
    );
    await expect(
      harness.useCase.execute(ACTOR, 't1', 's1', { expectedRecordVersion: 1 }),
    ).rejects.toBeInstanceOf(ActivityInvalidTransitionError);
  });

  it('rejects a stale version', async () => {
    harness.submissions.applyStatusChange.mockResolvedValue(null);
    await expect(
      harness.useCase.execute(ACTOR, 't1', 's1', { expectedRecordVersion: 1 }),
    ).rejects.toBeInstanceOf(ActivityVersionConflictError);
  });
});
