import {
  PlayerAssessmentStatus,
  ReviewDecision,
} from '../model/player-assessments.enums';

/**
 * Pure lifecycle state machine for a per-player assessment. Encodes the review
 * workflow from the product state map (DRAFT → SUBMITTED → IN_REVIEW → APPROVED →
 * PUBLISHED → REVISED): a draft is submitted; a submitted assessment is claimed
 * for review, approved, or reopened; an in-review assessment is approved or
 * reopened; an approved assessment is published; a published (or already-revised)
 * assessment is corrected into a new superseding revision. No side effects, no
 * time, no persistence — every branch is unit-tested.
 */

const TRANSITIONS: ReadonlyMap<
  PlayerAssessmentStatus,
  readonly PlayerAssessmentStatus[]
> = new Map([
  [PlayerAssessmentStatus.Draft, [PlayerAssessmentStatus.Submitted]],
  [
    PlayerAssessmentStatus.Submitted,
    [
      PlayerAssessmentStatus.InReview,
      PlayerAssessmentStatus.Approved,
      PlayerAssessmentStatus.Draft,
    ],
  ],
  [
    PlayerAssessmentStatus.InReview,
    [PlayerAssessmentStatus.Approved, PlayerAssessmentStatus.Draft],
  ],
  [PlayerAssessmentStatus.Approved, [PlayerAssessmentStatus.Published]],
  [PlayerAssessmentStatus.Published, [PlayerAssessmentStatus.Revised]],
  [PlayerAssessmentStatus.Revised, [PlayerAssessmentStatus.Revised]],
]);

/** The set of states reachable from `from` in one transition. */
export function allowedTransitions(
  from: PlayerAssessmentStatus,
): readonly PlayerAssessmentStatus[] {
  return TRANSITIONS.get(from) ?? [];
}

/** True when moving from `from` to `to` is a permitted status transition. */
export function canTransition(
  from: PlayerAssessmentStatus,
  to: PlayerAssessmentStatus,
): boolean {
  return allowedTransitions(from).includes(to);
}

/** A draft is the only editable working copy; every other state is locked. */
export function canEditDraft(status: PlayerAssessmentStatus): boolean {
  return status === PlayerAssessmentStatus.Draft;
}

/** Only an approved assessment may be published. */
export function canPublish(status: PlayerAssessmentStatus): boolean {
  return status === PlayerAssessmentStatus.Approved;
}

/**
 * A correction may target a published assessment or an already-revised one (a
 * chain of published corrections). The correction inserts a new REVISED revision
 * and supersedes the prior row.
 */
export function canCorrect(status: PlayerAssessmentStatus): boolean {
  return (
    status === PlayerAssessmentStatus.Published ||
    status === PlayerAssessmentStatus.Revised
  );
}

/** Map a reviewer decision to the status it targets (validity checked separately). */
export function resolveReviewTarget(
  decision: ReviewDecision,
): PlayerAssessmentStatus {
  if (decision === ReviewDecision.StartReview) {
    return PlayerAssessmentStatus.InReview;
  }
  if (decision === ReviewDecision.Approve) {
    return PlayerAssessmentStatus.Approved;
  }
  return PlayerAssessmentStatus.Draft;
}

/** Approving (or claiming review of) an assessment is subject to the no-self rule. */
export function reviewNeedsIndependence(decision: ReviewDecision): boolean {
  return decision !== ReviewDecision.Reject;
}
