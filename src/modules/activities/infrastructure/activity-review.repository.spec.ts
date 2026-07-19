import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ActivitySubmissionRow } from '../model/activity.rows';
import type {
  ReviewClaimChange,
  ReviewDecisionChange,
  ReviewReversalChange,
} from '../model/activity.types';
import { ActivityReviewRepository } from './activity-review.repository';

const NOW = new Date('2024-06-01T00:00:00.000Z');

const ROW: ActivitySubmissionRow = {
  id: 's1',
  team_id: 't1',
  season_id: null,
  membership_id: 'm1',
  activity_type_id: 'type-1',
  submitter_user_id: 'u1',
  status: 'under_review',
  performed_on: '2024-05-30',
  duration_minutes: 60,
  quantity: null,
  notes: 'note',
  review_note: null,
  record_version: 2,
  submitted_at: '2024-05-31T00:00:00.000Z',
  submitted_by: 'u1',
  reviewed_at: null,
  reviewed_by: null,
  reviewer_user_id: 'coach',
  review_started_at: '2024-06-01T00:00:00.000Z',
  reversal_reason: null,
  reversed_at: null,
  reversed_by: null,
  withdrawn_at: null,
  created_by: 'u1',
  created_at: '2024-05-30T00:00:00.000Z',
  updated_at: '2024-06-01T00:00:00.000Z',
  deleted_at: null,
};

const PAGE = { limit: 20, offset: 0 };

function build() {
  const scope = { run: vi.fn() };
  return { scope, repository: new ActivityReviewRepository() };
}

describe('ActivityReviewRepository', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('lists a bounded, deterministically ordered queue page', async () => {
    harness.scope.run.mockResolvedValueOnce([ROW]);
    const items = await harness.repository.listQueue(
      harness.scope as never,
      't1',
      {
        page: PAGE,
        statuses: ['submitted', 'under_review'] as never,
        activityTypeId: null,
        membershipId: null,
      },
    );
    expect(items).toHaveLength(1);
    const sql = String(harness.scope.run.mock.calls[0]?.[0]);
    expect(sql).toContain('"status" = ANY($2::text[])');
    expect(sql).toContain(
      'ORDER BY "submitted_at" ASC NULLS LAST, "created_at" ASC, "id" ASC',
    );
  });

  it('counts the queue and defaults a missing count to zero', async () => {
    harness.scope.run.mockResolvedValueOnce([{ count: 4 }]);
    await expect(
      harness.repository.countQueue(harness.scope as never, 't1', {
        page: PAGE,
        statuses: ['submitted'] as never,
        activityTypeId: 'type-1',
        membershipId: 'm1',
      }),
    ).resolves.toBe(4);

    harness.scope.run.mockResolvedValueOnce([]);
    await expect(
      harness.repository.countQueue(harness.scope as never, 't1', {
        page: PAGE,
        statuses: ['submitted'] as never,
        activityTypeId: null,
        membershipId: null,
      }),
    ).resolves.toBe(0);
  });

  it('claims a submitted claim or returns null on a guard miss', async () => {
    const change: ReviewClaimChange = {
      id: 's1',
      teamId: 't1',
      expectedRecordVersion: 1,
      reviewerUserId: 'coach',
      now: NOW,
    };
    harness.scope.run.mockResolvedValueOnce([ROW]);
    await expect(
      harness.repository.claimForReview(harness.scope as never, change),
    ).resolves.toMatchObject({ status: 'under_review' });
    expect(String(harness.scope.run.mock.calls[0]?.[0])).toContain(
      `"status" = 'submitted'`,
    );

    harness.scope.run.mockResolvedValueOnce([]);
    await expect(
      harness.repository.claimForReview(harness.scope as never, change),
    ).resolves.toBeNull();
  });

  it('applies a decision or returns null on a guard miss', async () => {
    const change: ReviewDecisionChange = {
      id: 's1',
      teamId: 't1',
      expectedRecordVersion: 2,
      toStatus: 'approved' as never,
      reviewNote: 'ok',
      reviewerUserId: 'coach',
      now: NOW,
    };
    harness.scope.run.mockResolvedValueOnce([{ ...ROW, status: 'approved' }]);
    await expect(
      harness.repository.applyDecision(harness.scope as never, change),
    ).resolves.toMatchObject({ status: 'approved' });
    expect(String(harness.scope.run.mock.calls[0]?.[0])).toContain(
      `"status" IN ('submitted', 'under_review')`,
    );

    harness.scope.run.mockResolvedValueOnce([]);
    await expect(
      harness.repository.applyDecision(harness.scope as never, change),
    ).resolves.toBeNull();
  });

  it('applies a reversal only against an approved claim', async () => {
    const change: ReviewReversalChange = {
      id: 's1',
      teamId: 't1',
      expectedRecordVersion: 3,
      reversalReason: 'duplicate',
      actorUserId: 'admin',
      now: NOW,
    };
    harness.scope.run.mockResolvedValueOnce([{ ...ROW, status: 'reversed' }]);
    await expect(
      harness.repository.applyReversal(harness.scope as never, change),
    ).resolves.toMatchObject({ status: 'reversed' });
    expect(String(harness.scope.run.mock.calls[0]?.[0])).toContain(
      `"status" = 'approved'`,
    );

    harness.scope.run.mockResolvedValueOnce([]);
    await expect(
      harness.repository.applyReversal(harness.scope as never, change),
    ).resolves.toBeNull();
  });

  it('returns the bounded anti-abuse probe counts', async () => {
    harness.scope.run.mockResolvedValueOnce([
      { same_day: 2, window_count: 9, buddy_repeat: 7 },
    ]);
    await expect(
      harness.repository.abuseCounts(
        harness.scope as never,
        'm1',
        's1',
        '2024-05-30',
        {
          windowFrom: '2024-05-24',
          windowTo: '2024-05-30',
          buddyFrom: '2024-05-01',
        },
      ),
    ).resolves.toEqual({ sameDay: 2, windowCount: 9, buddyRepeat: 7 });
  });

  it('defaults a missing anti-abuse probe row to zeroes', async () => {
    harness.scope.run.mockResolvedValueOnce([]);
    await expect(
      harness.repository.abuseCounts(
        harness.scope as never,
        'm1',
        's1',
        '2024-05-30',
        {
          windowFrom: '2024-05-24',
          windowTo: '2024-05-30',
          buddyFrom: '2024-05-01',
        },
      ),
    ).resolves.toEqual({ sameDay: 0, windowCount: 0, buddyRepeat: 0 });
  });

  it('detects whether the reviewer is a credited buddy', async () => {
    harness.scope.run.mockResolvedValueOnce([{ id: 'b1' }]);
    await expect(
      harness.repository.isReviewerCreditedBuddy(
        harness.scope as never,
        's1',
        'coach',
      ),
    ).resolves.toBe(true);

    harness.scope.run.mockResolvedValueOnce([]);
    await expect(
      harness.repository.isReviewerCreditedBuddy(
        harness.scope as never,
        's1',
        'coach',
      ),
    ).resolves.toBe(false);
  });
});
