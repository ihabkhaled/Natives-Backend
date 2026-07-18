/**
 * Lifecycle of a single per-player assessment. `draft` is the evaluator's private
 * working copy; `submitted` enters the review workflow; `in_review` is a claimed
 * review; `approved` is cleared for publication; `published` is the immutable,
 * player-visible result; `revised` is a superseding published correction. A
 * published or revised snapshot is never edited in place — corrections append a
 * new revision.
 */
export enum PlayerAssessmentStatus {
  Draft = 'draft',
  Submitted = 'submitted',
  InReview = 'in_review',
  Approved = 'approved',
  Published = 'published',
  Revised = 'revised',
}

export const PLAYER_ASSESSMENT_STATUS_VALUES: readonly PlayerAssessmentStatus[] =
  Object.values(PlayerAssessmentStatus);

/** A reviewer's decision on a submitted assessment. */
export enum ReviewDecision {
  StartReview = 'start_review',
  Approve = 'approve',
  Reject = 'reject',
}

export const REVIEW_DECISION_VALUES: readonly ReviewDecision[] =
  Object.values(ReviewDecision);
