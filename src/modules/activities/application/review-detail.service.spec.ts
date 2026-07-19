import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AbuseSignal, SubmissionStatus } from '../model/activity.enums';
import type { ActivitySubmission } from '../model/activity.types';
import { ReviewDetailService } from './review-detail.service';

const NOW = new Date('2024-06-02T00:00:00.000Z');

function submission(): ActivitySubmission {
  return {
    id: 's1',
    teamId: 't1',
    seasonId: null,
    membershipId: 'm1',
    activityTypeId: 'type-1',
    submitterUserId: 'member',
    status: SubmissionStatus.Submitted,
    performedOn: '2024-06-01',
    durationMinutes: 700,
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
  const clock = { now: vi.fn().mockReturnValue(NOW) };
  const review = {
    abuseCounts: vi
      .fn()
      .mockResolvedValue({ sameDay: 1, windowCount: 3, buddyRepeat: 0 }),
  };
  const buddies = { listForSubmission: vi.fn().mockResolvedValue([]) };
  const evidence = { countForSubmission: vi.fn().mockResolvedValue(2) };
  const service = new ReviewDetailService(
    clock as never,
    review as never,
    buddies as never,
    evidence as never,
  );
  return { clock, review, buddies, evidence, service };
}

describe('ReviewDetailService', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('assembles buddies, evidence count, and computed abuse signals', async () => {
    const view = await harness.service.assembleDetail(
      {} as never,
      submission(),
    );
    expect(view.evidenceCount).toBe(2);
    // sameDay=1 → duplicate-day; duration 700 > 600 → implausible-duration.
    expect(view.signals).toEqual([
      AbuseSignal.DuplicateDay,
      AbuseSignal.ImplausibleDuration,
    ]);
    expect(harness.review.abuseCounts).toHaveBeenCalledOnce();
  });

  it('probes anti-abuse counts against the frozen clock day', async () => {
    await harness.service.assembleDetail({} as never, submission());
    const window = harness.review.abuseCounts.mock.calls[0]?.[4];
    expect(window).toEqual({
      windowFrom: '2024-05-26',
      windowTo: '2024-06-02',
      buddyFrom: '2024-05-03',
    });
  });
});
