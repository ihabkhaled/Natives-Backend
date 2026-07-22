import { ClipStatus, ClipTransition } from '../model/analysis.enums';

/**
 * The clip review state machine (UN-505). Pure and total.
 *
 *   draft ──submit──▶ in_review ──publish──▶ published ──archive──▶ archived
 *     └────────────────publish───────────────┘
 *
 * `published` is terminal for editing: it may only be archived or superseded by
 * a revision (which moves it to `revised`). `revised` and `archived` accept no
 * further transition, so history is added to and never rewritten.
 */
const ALLOWED: ReadonlyMap<ClipStatus, readonly ClipStatus[]> = new Map([
  [ClipStatus.Draft, [ClipStatus.InReview, ClipStatus.Published]],
  [ClipStatus.InReview, [ClipStatus.Published, ClipStatus.Archived]],
  [ClipStatus.Published, [ClipStatus.Archived, ClipStatus.Revised]],
  [ClipStatus.Revised, []],
  [ClipStatus.Archived, []],
]);

const TRANSITION_TARGETS: ReadonlyMap<ClipTransition, ClipStatus> = new Map([
  [ClipTransition.Submit, ClipStatus.InReview],
  [ClipTransition.Publish, ClipStatus.Published],
  [ClipTransition.Archive, ClipStatus.Archived],
]);

/** The status a lifecycle verb targets. */
export function targetStatusOf(transition: ClipTransition): ClipStatus {
  return TRANSITION_TARGETS.get(transition) ?? ClipStatus.Draft;
}

export function canTransitionClip(from: ClipStatus, to: ClipStatus): boolean {
  return (ALLOWED.get(from) ?? []).includes(to);
}

/** Whether a clip is still freely editable in place. */
export function isEditableClip(status: ClipStatus): boolean {
  return status === ClipStatus.Draft || status === ClipStatus.InReview;
}

/** Whether the clip is a finalized record that may only be superseded. */
export function isFinalizedClip(status: ClipStatus): boolean {
  return status === ClipStatus.Published;
}

export function isPublishTarget(status: ClipStatus): boolean {
  return status === ClipStatus.Published;
}

export function isReviewTarget(status: ClipStatus): boolean {
  return status === ClipStatus.InReview;
}

export function isArchiveTarget(status: ClipStatus): boolean {
  return status === ClipStatus.Archived;
}
