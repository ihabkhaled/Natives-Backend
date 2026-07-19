import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ActivityReviewForbiddenError } from '../errors/activity-review-forbidden.error';
import { SubmissionStatus } from '../model/activity.enums';
import type { ActivitySubmission } from '../model/activity.types';
import { ReviewEligibilityService } from './review-eligibility.service';

const NOW = new Date('2024-06-01T00:00:00.000Z');

function submission(submitterUserId: string): ActivitySubmission {
  return {
    id: 's1',
    teamId: 't1',
    seasonId: null,
    membershipId: 'm1',
    activityTypeId: 'type-1',
    submitterUserId,
    status: SubmissionStatus.Submitted,
    performedOn: '2024-05-30',
    durationMinutes: 60,
    quantity: null,
    notes: null,
    reviewNote: null,
    recordVersion: 1,
    submittedAt: NOW,
    submittedBy: submitterUserId,
    reviewedAt: null,
    reviewedBy: null,
    reviewerUserId: null,
    reviewStartedAt: null,
    reversalReason: null,
    reversedAt: null,
    reversedBy: null,
    withdrawnAt: null,
    createdBy: submitterUserId,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function build() {
  const lookup = {
    requireForWrite: vi.fn().mockResolvedValue(submission('member')),
  };
  const review = {
    isReviewerCreditedBuddy: vi.fn().mockResolvedValue(false),
  };
  const service = new ReviewEligibilityService(
    lookup as never,
    review as never,
  );
  return { lookup, review, service };
}

describe('ReviewEligibilityService', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('returns the submission for an unrelated reviewer', async () => {
    await expect(
      harness.service.requireEligible({} as never, 't1', 's1', 'coach'),
    ).resolves.toMatchObject({ id: 's1' });
  });

  it('forbids self-review', async () => {
    await expect(
      harness.service.requireEligible({} as never, 't1', 's1', 'member'),
    ).rejects.toBeInstanceOf(ActivityReviewForbiddenError);
  });

  it('forbids reviewing a claim where the reviewer is a buddy', async () => {
    harness.review.isReviewerCreditedBuddy.mockResolvedValue(true);
    await expect(
      harness.service.requireEligible({} as never, 't1', 's1', 'coach'),
    ).rejects.toBeInstanceOf(ActivityReviewForbiddenError);
  });
});
