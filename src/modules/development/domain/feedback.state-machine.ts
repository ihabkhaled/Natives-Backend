import { FeedbackStatus } from '../model/feedback.enums';

/**
 * Pure lifecycle state machine for coach feedback (DRAFT → IN_REVIEW → PUBLISHED
 * → REVISED). A draft is the coach's private working copy; submitting moves it to
 * review; publishing shares it with the member as an immutable result; an
 * in-review record can be reopened to draft; a published (or already-revised)
 * record is corrected into a new superseding revision. No side effects, no time,
 * no persistence — every branch is unit-tested.
 */

const TRANSITIONS: ReadonlyMap<FeedbackStatus, readonly FeedbackStatus[]> =
  new Map([
    [FeedbackStatus.Draft, [FeedbackStatus.InReview]],
    [FeedbackStatus.InReview, [FeedbackStatus.Published, FeedbackStatus.Draft]],
    [FeedbackStatus.Published, [FeedbackStatus.Revised]],
    [FeedbackStatus.Revised, [FeedbackStatus.Revised]],
  ]);

/** The set of states reachable from `from` in one transition. */
export function allowedFeedbackTransitions(
  from: FeedbackStatus,
): readonly FeedbackStatus[] {
  return TRANSITIONS.get(from) ?? [];
}

/** True when moving from `from` to `to` is a permitted status transition. */
export function canTransitionFeedback(
  from: FeedbackStatus,
  to: FeedbackStatus,
): boolean {
  return allowedFeedbackTransitions(from).includes(to);
}

/** Only a draft is an editable working copy; every other state is locked. */
export function canEditFeedbackDraft(status: FeedbackStatus): boolean {
  return status === FeedbackStatus.Draft;
}

/** Only an in-review record may be published (shared with the member). */
export function canPublishFeedback(status: FeedbackStatus): boolean {
  return status === FeedbackStatus.InReview;
}

/**
 * A correction may target a published record or an already-revised one (a chain
 * of published corrections). The correction inserts a new REVISED revision and
 * supersedes the prior row.
 */
export function canCorrectFeedback(status: FeedbackStatus): boolean {
  return (
    status === FeedbackStatus.Published || status === FeedbackStatus.Revised
  );
}
