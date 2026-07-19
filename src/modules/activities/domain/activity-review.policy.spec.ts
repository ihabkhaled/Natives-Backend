import { describe, expect, it } from 'vitest';

import { ActivityReviewForbiddenError } from '../errors/activity-review-forbidden.error';
import { ActivityReviewNoteRequiredError } from '../errors/activity-review-note-required.error';
import { ActivityValidationError } from '../errors/activity-validation.error';
import { ReviewDecision, SubmissionStatus } from '../model/activity.enums';
import type { ActivitySubmission } from '../model/activity.types';
import {
  assertReviewerMayReview,
  assertReviewNote,
  isReviewNoteRequired,
  isSelfReview,
  resolveDecisionStatus,
} from './activity-review.policy';

const SUBMISSION: ActivitySubmission = {
  id: 's1',
  teamId: 't1',
  seasonId: null,
  membershipId: 'm1',
  activityTypeId: 'type-1',
  submitterUserId: 'submitter',
  status: SubmissionStatus.Submitted,
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
  createdBy: null,
  createdAt: new Date('2024-05-30T00:00:00.000Z'),
  updatedAt: new Date('2024-05-30T00:00:00.000Z'),
};

describe('activity-review.policy', () => {
  it('detects self-review', () => {
    expect(isSelfReview(SUBMISSION, 'submitter')).toBe(true);
    expect(isSelfReview(SUBMISSION, 'coach')).toBe(false);
  });

  it('forbids a reviewer reviewing their own claim', () => {
    expect(() =>
      assertReviewerMayReview(SUBMISSION, 'submitter', false),
    ).toThrow(ActivityReviewForbiddenError);
  });

  it('forbids a reviewer reviewing a claim where they are a buddy', () => {
    expect(() => assertReviewerMayReview(SUBMISSION, 'coach', true)).toThrow(
      ActivityReviewForbiddenError,
    );
  });

  it('allows an unrelated reviewer to act', () => {
    expect(() =>
      assertReviewerMayReview(SUBMISSION, 'coach', false),
    ).not.toThrow();
  });

  it('maps each decision to its target status', () => {
    expect(resolveDecisionStatus(ReviewDecision.Approve)).toBe(
      SubmissionStatus.Approved,
    );
    expect(resolveDecisionStatus(ReviewDecision.Reject)).toBe(
      SubmissionStatus.Rejected,
    );
    expect(resolveDecisionStatus(ReviewDecision.RequestChanges)).toBe(
      SubmissionStatus.ChangesRequested,
    );
  });

  it('rejects an unknown decision defensively', () => {
    expect(() => resolveDecisionStatus('bogus' as ReviewDecision)).toThrow(
      ActivityValidationError,
    );
  });

  it('requires a note only for denial decisions', () => {
    expect(isReviewNoteRequired(ReviewDecision.Approve)).toBe(false);
    expect(isReviewNoteRequired(ReviewDecision.Reject)).toBe(true);
    expect(isReviewNoteRequired(ReviewDecision.RequestChanges)).toBe(true);
  });

  it('permits an approval without a note', () => {
    expect(() => assertReviewNote(ReviewDecision.Approve, null)).not.toThrow();
  });

  it('accepts a non-blank note for a denial', () => {
    expect(() =>
      assertReviewNote(ReviewDecision.Reject, 'insufficient evidence'),
    ).not.toThrow();
  });

  it('rejects a missing or blank note for a denial', () => {
    expect(() => assertReviewNote(ReviewDecision.Reject, null)).toThrow(
      ActivityReviewNoteRequiredError,
    );
    expect(() =>
      assertReviewNote(ReviewDecision.RequestChanges, '   '),
    ).toThrow(ActivityReviewNoteRequiredError);
  });
});
