import { SubmissionStatus } from '../model/activity.enums';

/**
 * Pure lifecycle state machine for an external-training submission
 * (DRAFT → SUBMITTED → UNDER_REVIEW → CHANGES_REQUESTED →
 * APPROVED/REJECTED/WITHDRAWN/REVERSED). The full map is encoded so every branch
 * is unit-tested, but this slice drives only the member (submission) side:
 * editing a draft, submitting, resubmitting after changes were requested, and
 * withdrawing. No side effects, no time, no persistence.
 */

const TRANSITIONS: ReadonlyMap<SubmissionStatus, readonly SubmissionStatus[]> =
  new Map([
    [
      SubmissionStatus.Draft,
      [SubmissionStatus.Submitted, SubmissionStatus.Withdrawn],
    ],
    [
      SubmissionStatus.Submitted,
      [
        SubmissionStatus.UnderReview,
        SubmissionStatus.ChangesRequested,
        SubmissionStatus.Approved,
        SubmissionStatus.Rejected,
        SubmissionStatus.Withdrawn,
      ],
    ],
    [
      SubmissionStatus.UnderReview,
      [
        SubmissionStatus.ChangesRequested,
        SubmissionStatus.Approved,
        SubmissionStatus.Rejected,
        SubmissionStatus.Withdrawn,
      ],
    ],
    [
      SubmissionStatus.ChangesRequested,
      [SubmissionStatus.Submitted, SubmissionStatus.Withdrawn],
    ],
    [SubmissionStatus.Approved, [SubmissionStatus.Reversed]],
    [SubmissionStatus.Rejected, []],
    [SubmissionStatus.Withdrawn, []],
    [SubmissionStatus.Reversed, []],
  ]);

/** Terminal states hold no editable content and can be listed but never edited. */
const EDITABLE_STATES: readonly SubmissionStatus[] = [
  SubmissionStatus.Draft,
  SubmissionStatus.ChangesRequested,
];

/** The set of states reachable from `from` in one transition. */
export function allowedSubmissionTransitions(
  from: SubmissionStatus,
): readonly SubmissionStatus[] {
  return TRANSITIONS.get(from) ?? [];
}

/** True when moving from `from` to `to` is a permitted status transition. */
export function canTransitionSubmission(
  from: SubmissionStatus,
  to: SubmissionStatus,
): boolean {
  return allowedSubmissionTransitions(from).includes(to);
}

/**
 * A submission's content (and evidence) is editable only while it is a draft or
 * has been returned for changes; every other state is locked.
 */
export function canEditSubmission(status: SubmissionStatus): boolean {
  return EDITABLE_STATES.includes(status);
}

/** A draft or a changes-requested submission may be (re)submitted for review. */
export function canSubmitSubmission(status: SubmissionStatus): boolean {
  return canTransitionSubmission(status, SubmissionStatus.Submitted);
}

/** A non-decided submission may be withdrawn by its owner. */
export function canWithdrawSubmission(status: SubmissionStatus): boolean {
  return canTransitionSubmission(status, SubmissionStatus.Withdrawn);
}

/** A reviewer may claim a submitted claim into review (→ under_review). */
export function canClaimForReview(status: SubmissionStatus): boolean {
  return canTransitionSubmission(status, SubmissionStatus.UnderReview);
}

/** A submitted or under-review claim may be approved. */
export function canApproveSubmission(status: SubmissionStatus): boolean {
  return canTransitionSubmission(status, SubmissionStatus.Approved);
}

/** A submitted or under-review claim may be rejected. */
export function canRejectSubmission(status: SubmissionStatus): boolean {
  return canTransitionSubmission(status, SubmissionStatus.Rejected);
}

/** A submitted or under-review claim may be returned for changes. */
export function canRequestChangesOnSubmission(
  status: SubmissionStatus,
): boolean {
  return canTransitionSubmission(status, SubmissionStatus.ChangesRequested);
}

/** An approved claim may be reversed by a compensating correction. */
export function canReverseSubmission(status: SubmissionStatus): boolean {
  return canTransitionSubmission(status, SubmissionStatus.Reversed);
}
