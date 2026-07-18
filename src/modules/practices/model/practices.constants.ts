import type { ErrorMessageKey } from '@core/errors/error.types';

// --- Routes & OpenAPI tag ----------------------------------------------------
export const PRACTICES_ROUTE = 'teams';
export const PRACTICES_API_TAG = 'practices';

export const SCHEDULES_ROUTE = ':teamId/practice-schedules';
export const SCHEDULE_BY_ID_ROUTE = ':teamId/practice-schedules/:scheduleId';
export const SCHEDULE_GENERATE_ROUTE =
  ':teamId/practice-schedules/:scheduleId/generate';
export const SESSIONS_ROUTE = ':teamId/practice-sessions';
export const SESSION_BY_ID_ROUTE = ':teamId/practice-sessions/:sessionId';
export const SESSION_HISTORY_ROUTE =
  ':teamId/practice-sessions/:sessionId/history';
export const SESSION_PUBLISH_ROUTE =
  ':teamId/practice-sessions/:sessionId/publish';
export const SESSION_RESCHEDULE_ROUTE =
  ':teamId/practice-sessions/:sessionId/reschedule';
export const SESSION_CANCEL_ROUTE =
  ':teamId/practice-sessions/:sessionId/cancel';
export const SESSION_REOPEN_ROUTE =
  ':teamId/practice-sessions/:sessionId/reopen';

// --- Route param names -------------------------------------------------------
export const TEAM_ID_PARAM = 'teamId';
export const SCHEDULE_ID_PARAM = 'scheduleId';
export const SESSION_ID_PARAM = 'sessionId';

// --- Field bounds ------------------------------------------------------------
export const NAME_MIN_LENGTH = 1;
export const NAME_MAX_LENGTH = 120;
export const SESSION_TYPE_MIN_LENGTH = 1;
export const SESSION_TYPE_MAX_LENGTH = 64;
export const FIELD_MAX_LENGTH = 120;
export const NOTES_MAX_LENGTH = 2000;
export const REASON_MAX_LENGTH = 512;
export const TIMEZONE_MAX_LENGTH = 64;

export const WEEKDAY_MIN = 0;
export const WEEKDAY_MAX = 6;
export const WEEKDAYS_MAX_COUNT = 7;
export const INTERVAL_WEEKS_MIN = 1;
export const INTERVAL_WEEKS_MAX = 8;
export const DURATION_MINUTES_MIN = 1;
export const DURATION_MINUTES_MAX = 1440;
export const OFFSET_MINUTES_MIN = 0;
export const OFFSET_MINUTES_MAX = 1440;
export const CAPACITY_MIN = 0;
export const CAPACITY_MAX = 10000;
export const EXCEPTIONS_MAX_COUNT = 366;
export const EXPECTED_VERSION_MIN = 1;

// --- Defaults ----------------------------------------------------------------
export const DEFAULT_TIMEZONE = 'Africa/Cairo';
export const DEFAULT_INTERVAL_WEEKS = 1;

// --- Generation bounds -------------------------------------------------------
// Generation is bounded by a hard horizon and a hard occurrence cap so a single
// schedule can never fan out an unbounded number of rows (query-bounding rule).
export const MAX_HORIZON_DAYS = 400;
export const MAX_GENERATED_OCCURRENCES = 200;
// Upper bound on sessions scanned when reconciling a schedule's occurrences.
export const OCCURRENCE_SCAN_LIMIT = 1000;
export const HISTORY_SCAN_LIMIT = 500;

// --- Pagination --------------------------------------------------------------
export const LIST_DEFAULT_LIMIT = 20;
export const LIST_MIN_LIMIT = 1;
export const LIST_MAX_LIMIT = 100;
export const LIST_DEFAULT_OFFSET = 0;

// --- Validation patterns -----------------------------------------------------
// Local wall-clock time of day, 24-hour `HH:MM` (00:00–23:59).
export const LOCAL_TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/u;
// Date-only, ISO `YYYY-MM-DD` (no time component).
export const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;

// --- Domain event envelope ---------------------------------------------------
export const SESSION_AGGREGATE_TYPE = 'practice_session';
export const PRACTICE_EVENT_VERSION = 1;
export const PRACTICE_PUBLISHED_EVENT = 'practice.published';
export const PRACTICE_RESCHEDULED_EVENT = 'practice.rescheduled';
export const PRACTICE_CANCELLED_EVENT = 'practice.cancelled';
export const PRACTICE_VENUE_CHANGED_EVENT = 'practice.venue_changed';

// --- Audit action names ------------------------------------------------------
export const SCHEDULE_CREATED_ACTION = 'practice.scheduleCreated';
export const SCHEDULE_UPDATED_ACTION = 'practice.scheduleUpdated';
export const SCHEDULE_ARCHIVED_ACTION = 'practice.scheduleArchived';
export const SESSIONS_GENERATED_ACTION = 'practice.sessionsGenerated';
export const SESSION_CREATED_ACTION = 'practice.sessionCreated';
export const SESSION_UPDATED_ACTION = 'practice.sessionUpdated';
export const SESSION_TRANSITIONED_ACTION = 'practice.sessionTransitioned';
export const SESSION_RESCHEDULED_ACTION = 'practice.sessionRescheduled';
export const SESSION_ARCHIVED_ACTION = 'practice.sessionArchived';

export const SCHEDULE_RESOURCE_TYPE = 'practice_schedule';
export const SESSION_RESOURCE_TYPE = 'practice_session';

// --- Static read-column lists (never interpolate caller input) ----------------
// Date-only columns are read via to_char so no timezone conversion is applied to
// a calendar date; timestamptz columns are returned as-is (mapped to Date).
export const SCHEDULE_COLUMNS = `"id", "team_id", "season_id", "name", "session_type",
  "timezone", "frequency", "interval_weeks", "weekdays", "start_time_local",
  "duration_minutes", "meet_offset_minutes", "rsvp_cutoff_minutes",
  "default_venue_id", "default_field", "default_capacity", "visibility",
  "organizer_user_id", "notes",
  to_char("generation_start", 'YYYY-MM-DD') AS "generation_start",
  to_char("generation_until", 'YYYY-MM-DD') AS "generation_until",
  "exceptions", "status", "created_by", "updated_by", "created_at", "updated_at",
  "version"`;

export const SESSION_COLUMNS = `"id", "team_id", "season_id", "schedule_id",
  to_char("occurrence_date", 'YYYY-MM-DD') AS "occurrence_date",
  "session_type", "timezone", "venue_id", "field", "capacity",
  "meet_at", "starts_at", "ends_at", "rsvp_cutoff_at", "visibility",
  "organizer_user_id", "notes", "status", "cancellation_reason", "created_by",
  "updated_by", "created_at", "updated_at", "version"`;

export const STATUS_EVENT_COLUMNS = `"id", "session_id", "from_status",
  "to_status", "reason", "actor_user_id", "occurred_at"`;

// Idempotent-generation upsert guard: a duplicate (schedule, occurrence-date) is
// skipped, never overwriting a stable generated instance.
export const GENERATED_CONFLICT_CLAUSE =
  'ON CONFLICT ("schedule_id", "occurrence_date") ' +
  'WHERE "schedule_id" IS NOT NULL DO NOTHING';

// --- Error messages & keys ---------------------------------------------------
export const SCHEDULE_NOT_FOUND_MESSAGE = 'The practice schedule was not found';
export const SCHEDULE_NOT_FOUND_MESSAGE_KEY: ErrorMessageKey =
  'errors.practices.scheduleNotFound';

export const SESSION_NOT_FOUND_MESSAGE = 'The practice session was not found';
export const SESSION_NOT_FOUND_MESSAGE_KEY: ErrorMessageKey =
  'errors.practices.sessionNotFound';

export const TEAM_NOT_FOUND_MESSAGE = 'The team was not found';
export const TEAM_NOT_FOUND_MESSAGE_KEY: ErrorMessageKey =
  'errors.practices.teamNotFound';

export const VENUE_NOT_FOUND_MESSAGE =
  'The venue was not found in this team scope';
export const VENUE_NOT_FOUND_MESSAGE_KEY: ErrorMessageKey =
  'errors.practices.venueNotFound';

export const SEASON_NOT_FOUND_MESSAGE =
  'The season was not found in this team scope';
export const SEASON_NOT_FOUND_MESSAGE_KEY: ErrorMessageKey =
  'errors.practices.seasonNotFound';

export const INVALID_SCHEDULE_MESSAGE =
  'The schedule recurrence or horizon is invalid';
export const INVALID_SCHEDULE_MESSAGE_KEY: ErrorMessageKey =
  'errors.practices.invalidSchedule';

export const INVALID_SESSION_TIMES_MESSAGE =
  'The session end must not be before its start';
export const INVALID_SESSION_TIMES_MESSAGE_KEY: ErrorMessageKey =
  'errors.practices.invalidSessionTimes';

export const INVALID_TRANSITION_MESSAGE =
  'The session status change is not allowed from its current state';
export const INVALID_TRANSITION_MESSAGE_KEY: ErrorMessageKey =
  'errors.practices.invalidTransition';

export const VERSION_CONFLICT_MESSAGE =
  'The record was modified by someone else; reload and retry';
export const VERSION_CONFLICT_MESSAGE_KEY: ErrorMessageKey =
  'errors.practices.versionConflict';
