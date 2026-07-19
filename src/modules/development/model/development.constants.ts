import type { ErrorMessageKey } from '@core/errors/error.types';

// --- API surface -------------------------------------------------------------

export const DEVELOPMENT_API_TAG = 'development';
export const COACH_FEEDBACK_ROUTE = 'teams/:teamId/coach-feedback';
export const MY_FEEDBACK_ROUTE = 'teams/:teamId/my-feedback';
export const DEVELOPMENT_GOALS_ROUTE = 'teams/:teamId/development-goals';
export const MY_GOALS_ROUTE = 'teams/:teamId/my-development-goals';
export const DEVELOPMENT_REMINDERS_ROUTE =
  'teams/:teamId/development-reminders';

export const TEAM_ID_PARAM = 'teamId';
export const FEEDBACK_ID_PARAM = 'feedbackId';
export const GOAL_ID_PARAM = 'goalId';

export const FEEDBACK_DETAIL_ROUTE = ':feedbackId';
export const FEEDBACK_FIELDS_ROUTE = ':feedbackId/fields';
export const FEEDBACK_SUBMIT_ROUTE = ':feedbackId/submit';
export const FEEDBACK_PUBLISH_ROUTE = ':feedbackId/publish';
export const FEEDBACK_CORRECT_ROUTE = ':feedbackId/correct';
export const FEEDBACK_REVISIONS_ROUTE = ':feedbackId/revisions';
export const FEEDBACK_ACKNOWLEDGE_ROUTE = ':feedbackId/acknowledge';
export const GOAL_DETAIL_ROUTE = ':goalId';
export const GOAL_TRANSITION_ROUTE = ':goalId/transition';
export const GOAL_REVIEW_ROUTE = ':goalId/review';

// --- Pagination --------------------------------------------------------------

export const LIST_DEFAULT_LIMIT = 20;
export const LIST_MAX_LIMIT = 100;
export const LIST_MIN_LIMIT = 1;
export const LIST_DEFAULT_OFFSET = 0;
export const REMINDER_SCAN_MAX = 500;

// --- Field bounds ------------------------------------------------------------

export const FEEDBACK_FIELD_MAX_LENGTH = 4000;
export const COACH_NOTE_MAX_LENGTH = 4000;
export const CLARIFICATION_MAX_LENGTH = 2000;
export const REASON_MIN_LENGTH = 3;
export const REASON_MAX_LENGTH = 2000;
export const GOAL_TITLE_MIN_LENGTH = 2;
export const GOAL_TITLE_MAX_LENGTH = 200;
export const GOAL_TEXT_MAX_LENGTH = 4000;
export const ACTION_TEXT_MAX_LENGTH = 1000;
export const ACTIONS_MAX_ITEMS = 50;
export const ACTION_SORT_MIN = 0;
export const ACTION_SORT_MAX = 1000;
export const GOAL_NUMERIC_MIN = -1_000_000_000;
export const GOAL_NUMERIC_MAX = 1_000_000_000;
export const RECORD_VERSION_MIN = 1;
export const FIRST_REVISION = 1;

/** ISO date-only (YYYY-MM-DD) — goal due dates are calendar days, not instants. */
export const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;

// --- Error messages ----------------------------------------------------------

export const FEEDBACK_NOT_FOUND_MESSAGE =
  'The requested coach feedback was not found';
export const FEEDBACK_NOT_FOUND_MESSAGE_KEY: ErrorMessageKey =
  'errors.development.feedbackNotFound';
export const FEEDBACK_INVALID_TRANSITION_MESSAGE =
  'The coach feedback cannot make this workflow transition';
export const FEEDBACK_INVALID_TRANSITION_MESSAGE_KEY: ErrorMessageKey =
  'errors.development.feedbackInvalidTransition';
export const FEEDBACK_VERSION_CONFLICT_MESSAGE =
  'The coach feedback was modified concurrently';
export const FEEDBACK_VERSION_CONFLICT_MESSAGE_KEY: ErrorMessageKey =
  'errors.development.feedbackVersionConflict';
export const FEEDBACK_ALREADY_ACKNOWLEDGED_MESSAGE =
  'The coach feedback has already been acknowledged';
export const FEEDBACK_ALREADY_ACKNOWLEDGED_MESSAGE_KEY: ErrorMessageKey =
  'errors.development.feedbackAlreadyAcknowledged';
export const GOAL_NOT_FOUND_MESSAGE =
  'The requested development goal was not found';
export const GOAL_NOT_FOUND_MESSAGE_KEY: ErrorMessageKey =
  'errors.development.goalNotFound';
export const GOAL_INVALID_TRANSITION_MESSAGE =
  'The development goal cannot make this lifecycle transition';
export const GOAL_INVALID_TRANSITION_MESSAGE_KEY: ErrorMessageKey =
  'errors.development.goalInvalidTransition';
export const GOAL_VERSION_CONFLICT_MESSAGE =
  'The development goal was modified concurrently';
export const GOAL_VERSION_CONFLICT_MESSAGE_KEY: ErrorMessageKey =
  'errors.development.goalVersionConflict';
export const DEVELOPMENT_VALIDATION_MESSAGE =
  'The development request failed a domain validation rule';
export const DEVELOPMENT_VALIDATION_MESSAGE_KEY: ErrorMessageKey =
  'errors.development.validation';
export const DEVELOPMENT_SCOPE_NOT_FOUND_MESSAGE =
  'The team, season, or membership scope was not found';
export const DEVELOPMENT_SCOPE_NOT_FOUND_MESSAGE_KEY: ErrorMessageKey =
  'errors.development.scopeNotFound';

// --- Audit actions / resources ----------------------------------------------

export const FEEDBACK_RESOURCE_TYPE = 'coach_feedback';
export const FEEDBACK_AGGREGATE = 'coach_feedback';
export const FEEDBACK_CREATED_ACTION = 'development.feedback.created';
export const FEEDBACK_UPDATED_ACTION = 'development.feedback.updated';
export const FEEDBACK_SUBMITTED_ACTION = 'development.feedback.submitted';
export const FEEDBACK_PUBLISHED_ACTION = 'development.feedback.published';
export const FEEDBACK_REVISED_ACTION = 'development.feedback.revised';
export const FEEDBACK_ACKNOWLEDGED_ACTION = 'development.feedback.acknowledged';
export const GOAL_RESOURCE_TYPE = 'development_goal';
export const GOAL_AGGREGATE = 'development_goal';
export const GOAL_CREATED_ACTION = 'development.goal.created';
export const GOAL_UPDATED_ACTION = 'development.goal.updated';
export const GOAL_TRANSITIONED_ACTION = 'development.goal.transitioned';

// --- Domain events (past-tense, versioned, privacy-safe payloads) ------------

export const DEVELOPMENT_EVENT_VERSION = 1;
export const FEEDBACK_PUBLISHED_EVENT = 'development.feedback.published.v1';
export const FEEDBACK_REVISED_EVENT = 'development.feedback.revised.v1';
export const FEEDBACK_ACKNOWLEDGED_EVENT =
  'development.feedback.acknowledged.v1';
export const FEEDBACK_CLARIFICATION_EVENT =
  'development.feedback.clarificationRequested.v1';
export const FEEDBACK_REMINDER_EVENT = 'development.feedback.reminderDue.v1';
export const GOAL_CREATED_EVENT = 'development.goal.created.v1';
export const GOAL_UPDATED_EVENT = 'development.goal.updated.v1';
export const GOAL_OVERDUE_REMINDER_EVENT =
  'development.goal.overdueReminder.v1';

// --- Static column lists (never SELECT *) ------------------------------------

export const COACH_FEEDBACK_COLUMNS = `"id", "family_id", "team_id", "season_id",
  "membership_id", "author_user_id", "status", "revision", "record_version",
  "positive_frisbee", "frisbee_improvement", "positive_mental",
  "mental_improvement", "team_role", "recommended_position", "summary",
  "coach_note", "submitted_at", "submitted_by", "published_at", "published_by",
  "superseded_at", "superseded_by_id", "created_by", "created_at", "updated_at"`;

/**
 * The bounded team-list projection deliberately omits every free-text field —
 * above all the private coach note — so a broad list endpoint can never surface
 * private content. Detail reads use the full column list under feedback.manage.
 */
export const COACH_FEEDBACK_SUMMARY_COLUMNS = `"id", "family_id", "team_id",
  "membership_id", "author_user_id", "status", "revision", "record_version",
  "created_at", "published_at"`;

export const FEEDBACK_ACKNOWLEDGEMENT_COLUMNS = `"id", "feedback_id",
  "membership_id", "user_id", "acknowledged_at", "clarification_requested",
  "clarification_note", "created_at"`;

export const DEVELOPMENT_GOAL_COLUMNS = `"id", "team_id", "season_id",
  "membership_id", "feedback_id", "metric_definition_id", "owner_user_id",
  "title", "description", "measurable_target", "target_value", "baseline_value",
  "progress_value", "progress_note", "evidence", "status", "due_date",
  "completed_at", "review_note", "reviewed_at", "reviewed_by", "record_version",
  "created_by", "created_at", "updated_at", "deleted_at"`;

export const GOAL_ACTION_COLUMNS = `"id", "goal_id", "description", "sort_order",
  "done", "due_date", "created_at"`;
