/**
 * Lifecycle of an external-training submission. A submission is a CLAIM, never
 * awarded points. `draft` is the member's private working copy; `submitted` enters
 * the review queue; `under_review` is claimed by a reviewer; `changes_requested`
 * is returned for edits and can be resubmitted; `approved`/`rejected` are review
 * outcomes; `withdrawn` is the member pulling the claim; `reversed` compensates a
 * prior approval. Review/moderation transitions are owned by prompt 401 — this
 * slice implements the member (submission) side.
 */
export enum SubmissionStatus {
  Draft = 'draft',
  Submitted = 'submitted',
  UnderReview = 'under_review',
  ChangesRequested = 'changes_requested',
  Approved = 'approved',
  Rejected = 'rejected',
  Withdrawn = 'withdrawn',
  Reversed = 'reversed',
}

export const SUBMISSION_STATUS_VALUES: readonly SubmissionStatus[] =
  Object.values(SubmissionStatus);

/** The kind of evidence reference attached to a submission (metadata only). */
export enum EvidenceKind {
  Link = 'link',
  File = 'file',
  Note = 'note',
}

export const EVIDENCE_KIND_VALUES: readonly EvidenceKind[] =
  Object.values(EvidenceKind);

/** Malware/verification scan state of an evidence reference. */
export enum EvidenceScanStatus {
  Pending = 'pending',
  Clean = 'clean',
  Infected = 'infected',
  Failed = 'failed',
}

export const EVIDENCE_SCAN_STATUS_VALUES: readonly EvidenceScanStatus[] =
  Object.values(EvidenceScanStatus);

/**
 * Confirmation state of a credited training buddy. A buddy link is `pending`
 * until the credited member `confirmed` or `declined` their participation.
 */
export enum BuddyStatus {
  Pending = 'pending',
  Confirmed = 'confirmed',
  Declined = 'declined',
}

export const BUDDY_STATUS_VALUES: readonly BuddyStatus[] =
  Object.values(BuddyStatus);

/** A credited member's response to a buddy link. */
export enum BuddyDecision {
  Confirm = 'confirm',
  Decline = 'decline',
}

export const BUDDY_DECISION_VALUES: readonly BuddyDecision[] =
  Object.values(BuddyDecision);

/** Broad category of an activity type (audited taxonomy, not free text). */
export enum ActivityCategory {
  Gym = 'gym',
  Running = 'running',
  Throwing = 'throwing',
  Pickup = 'pickup',
  OtherSport = 'other_sport',
  TeamDrills = 'team_drills',
  RulesQuiz = 'rules_quiz',
  Accreditation = 'accreditation',
  Custom = 'custom',
}

export const ACTIVITY_CATEGORY_VALUES: readonly ActivityCategory[] =
  Object.values(ActivityCategory);

/**
 * Approval state of an activity type's candidate point value. `pending` means the
 * point value is not yet decided (WFDF accreditation, custom) and stays NULL until
 * a rules owner approves it — never guessed.
 */
export enum PointsApproval {
  Approved = 'approved',
  Pending = 'pending',
}

export const POINTS_APPROVAL_VALUES: readonly PointsApproval[] =
  Object.values(PointsApproval);

/** Catalog availability of an activity type. */
export enum ActivityTypeStatus {
  Active = 'active',
  Archived = 'archived',
}

export const ACTIVITY_TYPE_STATUS_VALUES: readonly ActivityTypeStatus[] =
  Object.values(ActivityTypeStatus);
