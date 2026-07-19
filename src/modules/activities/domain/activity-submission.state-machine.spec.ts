import { describe, expect, it } from 'vitest';

import { SubmissionStatus } from '../model/activity.enums';
import {
  allowedSubmissionTransitions,
  canApproveSubmission,
  canClaimForReview,
  canEditSubmission,
  canRejectSubmission,
  canRequestChangesOnSubmission,
  canReverseSubmission,
  canSubmitSubmission,
  canTransitionSubmission,
  canWithdrawSubmission,
} from './activity-submission.state-machine';

describe('activity-submission.state-machine', () => {
  it('maps the full lifecycle transitions', () => {
    expect(allowedSubmissionTransitions(SubmissionStatus.Draft)).toEqual([
      SubmissionStatus.Submitted,
      SubmissionStatus.Withdrawn,
    ]);
    expect(
      allowedSubmissionTransitions(SubmissionStatus.ChangesRequested),
    ).toEqual([SubmissionStatus.Submitted, SubmissionStatus.Withdrawn]);
    expect(allowedSubmissionTransitions(SubmissionStatus.Approved)).toEqual([
      SubmissionStatus.Reversed,
    ]);
    expect(allowedSubmissionTransitions(SubmissionStatus.Rejected)).toEqual([]);
    expect(allowedSubmissionTransitions(SubmissionStatus.Withdrawn)).toEqual(
      [],
    );
    expect(allowedSubmissionTransitions(SubmissionStatus.Reversed)).toEqual([]);
  });

  it('permits submitted and under_review to fan out to review outcomes', () => {
    expect(allowedSubmissionTransitions(SubmissionStatus.Submitted)).toContain(
      SubmissionStatus.UnderReview,
    );
    expect(
      allowedSubmissionTransitions(SubmissionStatus.UnderReview),
    ).toContain(SubmissionStatus.Approved);
  });

  it('accepts and rejects specific transitions', () => {
    expect(
      canTransitionSubmission(
        SubmissionStatus.Draft,
        SubmissionStatus.Submitted,
      ),
    ).toBe(true);
    expect(
      canTransitionSubmission(
        SubmissionStatus.Draft,
        SubmissionStatus.Approved,
      ),
    ).toBe(false);
    expect(
      canTransitionSubmission(
        SubmissionStatus.Withdrawn,
        SubmissionStatus.Submitted,
      ),
    ).toBe(false);
  });

  it('allows editing only drafts and changes-requested submissions', () => {
    expect(canEditSubmission(SubmissionStatus.Draft)).toBe(true);
    expect(canEditSubmission(SubmissionStatus.ChangesRequested)).toBe(true);
    expect(canEditSubmission(SubmissionStatus.Submitted)).toBe(false);
    expect(canEditSubmission(SubmissionStatus.Approved)).toBe(false);
  });

  it('allows (re)submitting a draft or changes-requested submission', () => {
    expect(canSubmitSubmission(SubmissionStatus.Draft)).toBe(true);
    expect(canSubmitSubmission(SubmissionStatus.ChangesRequested)).toBe(true);
    expect(canSubmitSubmission(SubmissionStatus.Submitted)).toBe(false);
    expect(canSubmitSubmission(SubmissionStatus.Approved)).toBe(false);
  });

  it('allows withdrawing any non-decided submission', () => {
    expect(canWithdrawSubmission(SubmissionStatus.Draft)).toBe(true);
    expect(canWithdrawSubmission(SubmissionStatus.Submitted)).toBe(true);
    expect(canWithdrawSubmission(SubmissionStatus.UnderReview)).toBe(true);
    expect(canWithdrawSubmission(SubmissionStatus.ChangesRequested)).toBe(true);
    expect(canWithdrawSubmission(SubmissionStatus.Approved)).toBe(false);
    expect(canWithdrawSubmission(SubmissionStatus.Rejected)).toBe(false);
  });

  it('claims only a submitted claim into review', () => {
    expect(canClaimForReview(SubmissionStatus.Submitted)).toBe(true);
    expect(canClaimForReview(SubmissionStatus.UnderReview)).toBe(false);
    expect(canClaimForReview(SubmissionStatus.ChangesRequested)).toBe(false);
    expect(canClaimForReview(SubmissionStatus.Draft)).toBe(false);
  });

  it('decides only from submitted or under_review', () => {
    for (const decide of [
      canApproveSubmission,
      canRejectSubmission,
      canRequestChangesOnSubmission,
    ]) {
      expect(decide(SubmissionStatus.Submitted)).toBe(true);
      expect(decide(SubmissionStatus.UnderReview)).toBe(true);
      expect(decide(SubmissionStatus.Draft)).toBe(false);
      expect(decide(SubmissionStatus.Approved)).toBe(false);
    }
  });

  it('reverses only an approved claim', () => {
    expect(canReverseSubmission(SubmissionStatus.Approved)).toBe(true);
    expect(canReverseSubmission(SubmissionStatus.Submitted)).toBe(false);
    expect(canReverseSubmission(SubmissionStatus.Rejected)).toBe(false);
    expect(canReverseSubmission(SubmissionStatus.Reversed)).toBe(false);
  });
});
