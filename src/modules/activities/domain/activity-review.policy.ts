import { ActivityReviewForbiddenError } from '../errors/activity-review-forbidden.error';
import { ActivityReviewNoteRequiredError } from '../errors/activity-review-note-required.error';
import { ActivityValidationError } from '../errors/activity-validation.error';
import { ReviewDecision, SubmissionStatus } from '../model/activity.enums';
import type { ActivitySubmission } from '../model/activity.types';

/**
 * Pure moderation rules for a reviewer acting on a submission. A reviewer may
 * never decide on their own claim (self-review) or one where they are a credited
 * training buddy — both are conflicts of interest enforced server-side (403). The
 * decision → target-status map and the structured-note requirement live here so
 * every branch is unit-tested without a database, transport, or clock.
 */

const DECISION_STATUS: ReadonlyMap<ReviewDecision, SubmissionStatus> = new Map([
  [ReviewDecision.Approve, SubmissionStatus.Approved],
  [ReviewDecision.Reject, SubmissionStatus.Rejected],
  [ReviewDecision.RequestChanges, SubmissionStatus.ChangesRequested],
]);

/** Decisions whose denial semantics require a structured, member-safe reason. */
const NOTE_REQUIRED_DECISIONS: readonly ReviewDecision[] = [
  ReviewDecision.Reject,
  ReviewDecision.RequestChanges,
];

/** True when the acting reviewer is the member who submitted the claim. */
export function isSelfReview(
  submission: ActivitySubmission,
  reviewerUserId: string,
): boolean {
  return submission.submitterUserId === reviewerUserId;
}

/**
 * Guard a reviewer's eligibility to moderate or correct a submission: neither the
 * submitter (self-review) nor a credited buddy on it may act. `reviewerIsBuddy`
 * is resolved against the database by the caller; the rule stays pure.
 */
export function assertReviewerMayReview(
  submission: ActivitySubmission,
  reviewerUserId: string,
  reviewerIsBuddy: boolean,
): void {
  if (isSelfReview(submission, reviewerUserId) || reviewerIsBuddy) {
    throw new ActivityReviewForbiddenError();
  }
}

/** Map a moderation decision onto the submission status it drives. */
export function resolveDecisionStatus(
  decision: ReviewDecision,
): SubmissionStatus {
  const status = DECISION_STATUS.get(decision);
  if (status === undefined) {
    throw new ActivityValidationError();
  }
  return status;
}

/** True when the decision must carry a structured reviewer note. */
export function isReviewNoteRequired(decision: ReviewDecision): boolean {
  return NOTE_REQUIRED_DECISIONS.includes(decision);
}

/**
 * Enforce that a reject / request-changes decision carries a non-blank note;
 * approvals may omit it. A blank string counts as missing.
 */
export function assertReviewNote(
  decision: ReviewDecision,
  reviewNote: string | null,
): void {
  if (!isReviewNoteRequired(decision)) {
    return;
  }
  if (reviewNote === null || reviewNote.trim().length === 0) {
    throw new ActivityReviewNoteRequiredError();
  }
}
