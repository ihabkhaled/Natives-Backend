import type { ErrorMessageKey } from '@core/errors/error.types';

import { SubmissionStatus } from './activity.enums';

// --- API surface -------------------------------------------------------------

export const ACTIVITIES_API_TAG = 'activities';
export const ACTIVITY_TYPES_ROUTE = 'teams/:teamId/activity-types';
export const ACTIVITY_SUBMISSIONS_ROUTE = 'teams/:teamId/activity-submissions';
export const MY_ACTIVITY_BUDDIES_ROUTE = 'teams/:teamId/my-activity-buddies';
export const ACTIVITY_REVIEW_ROUTE = 'teams/:teamId/activity-review';

export const TEAM_ID_PARAM = 'teamId';
export const SUBMISSION_ID_PARAM = 'submissionId';
export const BUDDY_ID_PARAM = 'buddyId';

export const SUBMISSION_DETAIL_ROUTE = ':submissionId';
export const SUBMISSION_SUBMIT_ROUTE = ':submissionId/submit';
export const SUBMISSION_WITHDRAW_ROUTE = ':submissionId/withdraw';
export const SUBMISSION_EVIDENCE_ROUTE = ':submissionId/evidence';
export const BUDDY_CONFIRM_ROUTE = ':buddyId/confirm';
export const BUDDY_DECLINE_ROUTE = ':buddyId/decline';
export const REVIEW_DETAIL_ROUTE = ':submissionId';
export const REVIEW_CLAIM_ROUTE = ':submissionId/claim';
export const REVIEW_APPROVE_ROUTE = ':submissionId/approve';
export const REVIEW_REJECT_ROUTE = ':submissionId/reject';
export const REVIEW_REQUEST_CHANGES_ROUTE = ':submissionId/request-changes';
export const REVIEW_CORRECT_ROUTE = ':submissionId/correct';

// --- Pagination --------------------------------------------------------------

export const LIST_DEFAULT_LIMIT = 20;
export const LIST_MAX_LIMIT = 100;
export const LIST_MIN_LIMIT = 1;
export const LIST_DEFAULT_OFFSET = 0;

// --- Field bounds ------------------------------------------------------------

export const NOTES_MAX_LENGTH = 4000;
export const DURATION_MIN_MINUTES = 1;
export const DURATION_MAX_MINUTES = 1440;
export const QUANTITY_MIN = 0;
export const QUANTITY_MAX = 1_000_000;
export const RECORD_VERSION_MIN = 1;

export const REVIEW_NOTE_MAX_LENGTH = 2000;
export const REVERSAL_REASON_MIN_LENGTH = 1;
export const REVERSAL_REASON_MAX_LENGTH = 2000;

export const BUDDIES_MAX_ITEMS = 20;
export const EVIDENCE_MAX_ITEMS = 10;
export const EVIDENCE_REFERENCE_MAX_LENGTH = 1024;
export const EVIDENCE_DESCRIPTION_MAX_LENGTH = 500;
export const EVIDENCE_CONTENT_TYPE_MAX_LENGTH = 255;
export const EVIDENCE_BYTE_SIZE_MIN = 1;
export const EVIDENCE_BYTE_SIZE_MAX = 104_857_600;

/**
 * Whether a credited buddy must confirm before the credit counts. When true
 * (the versioned default policy) a new buddy link is `pending`; when false a
 * buddy is auto-linked as `confirmed`. Kept as configurable data, not a scattered
 * literal, so the policy can be versioned without touching the state machine.
 */
export const BUDDY_CONFIRMATION_REQUIRED = true;

/** ISO date-only (YYYY-MM-DD) — activities are performed on a calendar day. */
export const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;

// --- Anti-abuse signal thresholds (versioned policy data, never guilt) --------

/** Rolling window (days, inclusive) over which submission volume is assessed. */
export const ABUSE_VOLUME_WINDOW_DAYS = 7;
/** More than this many live claims in the window flags an unusual-volume signal. */
export const ABUSE_VOLUME_MAX_IN_WINDOW = 14;
/** Backdating a claim more than this many days before today is flagged. */
export const ABUSE_BACKDATE_MAX_DAYS = 60;
/** A single-session duration beyond this many minutes is implausible. */
export const ABUSE_IMPLAUSIBLE_DURATION_MINUTES = 600;
/** Pairing with the same buddy more than this many times recently is flagged. */
export const ABUSE_REPEATED_BUDDY_MAX = 5;
/** Lookback (days) over which repeated-buddy pairings are counted. */
export const ABUSE_BUDDY_WINDOW_DAYS = 30;

// --- Review queue --------------------------------------------------------------

/** The states a reviewer works on when no explicit status filter is supplied. */
export const REVIEW_QUEUE_DEFAULT_STATUSES: readonly SubmissionStatus[] = [
  SubmissionStatus.Submitted,
  SubmissionStatus.UnderReview,
  SubmissionStatus.ChangesRequested,
];

/** The allowlisted states a reviewer may filter the queue to (never drafts). */
export const REVIEW_QUEUE_FILTERABLE_STATUSES: readonly SubmissionStatus[] = [
  SubmissionStatus.Submitted,
  SubmissionStatus.UnderReview,
  SubmissionStatus.ChangesRequested,
  SubmissionStatus.Approved,
  SubmissionStatus.Rejected,
  SubmissionStatus.Reversed,
];

// --- Error messages ----------------------------------------------------------

export const SUBMISSION_NOT_FOUND_MESSAGE =
  'The requested activity submission was not found';
export const SUBMISSION_NOT_FOUND_MESSAGE_KEY: ErrorMessageKey =
  'errors.activities.submissionNotFound';
export const ACTIVITY_TYPE_NOT_FOUND_MESSAGE =
  'The requested activity type was not found or is not active';
export const ACTIVITY_TYPE_NOT_FOUND_MESSAGE_KEY: ErrorMessageKey =
  'errors.activities.typeNotFound';
export const ACTIVITY_SCOPE_NOT_FOUND_MESSAGE =
  'The team, season, or membership scope was not found';
export const ACTIVITY_SCOPE_NOT_FOUND_MESSAGE_KEY: ErrorMessageKey =
  'errors.activities.scopeNotFound';
export const ACTIVITY_INVALID_TRANSITION_MESSAGE =
  'The activity submission cannot make this workflow transition';
export const ACTIVITY_INVALID_TRANSITION_MESSAGE_KEY: ErrorMessageKey =
  'errors.activities.invalidTransition';
export const ACTIVITY_VERSION_CONFLICT_MESSAGE =
  'The activity submission was modified concurrently';
export const ACTIVITY_VERSION_CONFLICT_MESSAGE_KEY: ErrorMessageKey =
  'errors.activities.versionConflict';
export const ACTIVITY_VALIDATION_MESSAGE =
  'The activity submission failed a domain validation rule';
export const ACTIVITY_VALIDATION_MESSAGE_KEY: ErrorMessageKey =
  'errors.activities.validation';
export const ACTIVITY_DUPLICATE_MESSAGE =
  'A live submission already exists for this activity type and date';
export const ACTIVITY_DUPLICATE_MESSAGE_KEY: ErrorMessageKey =
  'errors.activities.duplicateSubmission';
export const BUDDY_NOT_FOUND_MESSAGE =
  'The requested training buddy credit was not found';
export const BUDDY_NOT_FOUND_MESSAGE_KEY: ErrorMessageKey =
  'errors.activities.buddyNotFound';
export const BUDDY_ALREADY_RESOLVED_MESSAGE =
  'The training buddy credit has already been answered';
export const BUDDY_ALREADY_RESOLVED_MESSAGE_KEY: ErrorMessageKey =
  'errors.activities.buddyAlreadyResolved';
export const ACTIVITY_REVIEW_FORBIDDEN_MESSAGE =
  'A reviewer may not review or correct their own or a buddied submission';
export const ACTIVITY_REVIEW_FORBIDDEN_MESSAGE_KEY: ErrorMessageKey =
  'errors.activities.reviewForbidden';
export const ACTIVITY_REVIEW_NOTE_REQUIRED_MESSAGE =
  'A structured reviewer note is required for this decision';
export const ACTIVITY_REVIEW_NOTE_REQUIRED_MESSAGE_KEY: ErrorMessageKey =
  'errors.activities.reviewNoteRequired';

// --- Audit actions / resources ----------------------------------------------

export const SUBMISSION_RESOURCE_TYPE = 'activity_submission';
export const SUBMISSION_AGGREGATE = 'activity_submission';
export const BUDDY_RESOURCE_TYPE = 'activity_buddy';
export const SUBMISSION_CREATED_ACTION = 'activities.submission.created';
export const SUBMISSION_UPDATED_ACTION = 'activities.submission.updated';
export const SUBMISSION_SUBMITTED_ACTION = 'activities.submission.submitted';
export const SUBMISSION_WITHDRAWN_ACTION = 'activities.submission.withdrawn';
export const BUDDY_RESPONDED_ACTION = 'activities.buddy.responded';
export const REVIEW_CLAIMED_ACTION = 'activities.review.claimed';
export const REVIEW_DECIDED_ACTION = 'activities.review.decided';
export const REVIEW_CORRECTED_ACTION = 'activities.review.corrected';

// --- Domain events (past-tense, versioned, privacy-safe payloads) ------------

export const ACTIVITIES_EVENT_VERSION = 1;
export const ACTIVITY_SUBMITTED_EVENT = 'activities.submission.submitted.v1';
export const ACTIVITY_WITHDRAWN_EVENT = 'activities.submission.withdrawn.v1';
export const ACTIVITY_APPROVED_EVENT = 'activities.submission.approved.v1';
export const ACTIVITY_REJECTED_EVENT = 'activities.submission.rejected.v1';
export const ACTIVITY_CHANGES_REQUESTED_EVENT =
  'activities.submission.changes_requested.v1';
export const ACTIVITY_CORRECTED_EVENT = 'activities.submission.corrected.v1';

// --- Static column lists (never SELECT *) ------------------------------------

export const ACTIVITY_TYPE_COLUMNS = `"id", "family_id", "type_key", "name",
  "description", "category", "unit", "default_point_value", "points_approval",
  "requires_evidence", "min_duration_minutes", "max_duration_minutes", "status",
  "catalog_version", "created_at"`;

export const ACTIVITY_SUBMISSION_COLUMNS = `"id", "team_id", "season_id",
  "membership_id", "activity_type_id", "submitter_user_id", "status",
  "performed_on", "duration_minutes", "quantity", "notes", "review_note",
  "record_version", "submitted_at", "submitted_by", "reviewed_at", "reviewed_by",
  "reviewer_user_id", "review_started_at", "reversal_reason", "reversed_at",
  "reversed_by", "withdrawn_at", "created_by", "created_at", "updated_at",
  "deleted_at"`;

export const ACTIVITY_EVIDENCE_COLUMNS = `"id", "submission_id", "kind",
  "storage_reference", "content_type", "byte_size", "description", "scan_status",
  "created_by", "created_at"`;

export const ACTIVITY_BUDDY_COLUMNS = `"id", "submission_id", "membership_id",
  "status", "responded_at", "responded_by", "created_at"`;
