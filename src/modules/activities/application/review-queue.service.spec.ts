import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ActivitySubmissionNotFoundError } from '../errors/activity-submission-not-found.error';
import { SubmissionStatus } from '../model/activity.enums';
import type {
  ActivitySubmission,
  ReviewQueueQuery,
} from '../model/activity.types';
import { ReviewQueueService } from './review-queue.service';

const NOW = new Date('2024-06-01T00:00:00.000Z');

const QUERY: ReviewQueueQuery = {
  page: { limit: 20, offset: 0 },
  statuses: [SubmissionStatus.Submitted],
  activityTypeId: null,
  membershipId: null,
};

function submission(): ActivitySubmission {
  return {
    id: 's1',
    teamId: 't1',
    seasonId: null,
    membershipId: 'm1',
    activityTypeId: 'type-1',
    submitterUserId: 'member',
    status: SubmissionStatus.Submitted,
    performedOn: '2024-05-30',
    durationMinutes: 60,
    quantity: null,
    notes: null,
    reviewNote: 'note',
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
  const review = {
    listQueue: vi.fn().mockResolvedValue([submission()]),
    countQueue: vi.fn().mockResolvedValue(1),
  };
  const submissions = {
    findForWrite: vi.fn().mockResolvedValue(submission()),
  };
  const detail = {
    assembleDetail: vi.fn().mockResolvedValue({ submission: submission() }),
  };
  const service = new ReviewQueueService(
    unitOfWork as never,
    review as never,
    submissions as never,
    detail as never,
  );
  return { review, submissions, detail, service };
}

describe('ReviewQueueService', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('returns a bounded, mapped queue page with a total', async () => {
    const page = await harness.service.listQueue('t1', QUERY);
    expect(page.total).toBe(1);
    expect(page.limit).toBe(20);
    expect(page.items[0]?.reviewNote).toBe('note');
  });

  it('assembles a review detail for a found submission', async () => {
    await harness.service.getDetail('t1', 's1');
    expect(harness.detail.assembleDetail).toHaveBeenCalledOnce();
  });

  it('404s a submission outside the team', async () => {
    harness.submissions.findForWrite.mockResolvedValue(null);
    await expect(harness.service.getDetail('t1', 'sx')).rejects.toBeInstanceOf(
      ActivitySubmissionNotFoundError,
    );
  });
});
