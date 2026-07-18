import type { ErrorMessageKey } from '@core/errors/error.types';

// --- Routes (team + session scoped, mounted under PRACTICES_ROUTE = 'teams') ---
export const ATTENDANCE_LIST_ROUTE =
  ':teamId/practice-sessions/:sessionId/attendance';
export const ATTENDANCE_SELF_ROUTE =
  ':teamId/practice-sessions/:sessionId/attendance/me';
export const ATTENDANCE_CHECK_IN_ROUTE =
  ':teamId/practice-sessions/:sessionId/attendance/check-in';
export const ATTENDANCE_BULK_ROUTE =
  ':teamId/practice-sessions/:sessionId/attendance/bulk';
export const ATTENDANCE_FINALIZE_ROUTE =
  ':teamId/practice-sessions/:sessionId/attendance/finalize';
export const ATTENDANCE_RECORD_ROUTE =
  ':teamId/practice-sessions/:sessionId/attendance/:membershipId';
export const ATTENDANCE_CORRECTION_ROUTE =
  ':teamId/practice-sessions/:sessionId/attendance/:membershipId/correction';
export const ATTENDANCE_HISTORY_ROUTE =
  ':teamId/practice-sessions/:sessionId/attendance/:membershipId/history';
export const PARTICIPATION_ROUTE =
  ':teamId/attendance/participation/:membershipId';
export const PARTICIPATION_SELF_ROUTE = ':teamId/attendance/me/participation';

export const SEASON_ID_QUERY = 'seasonId';

// --- Field bounds ------------------------------------------------------------
export const ATTENDANCE_NOTE_MAX_LENGTH = 1000;
export const EVIDENCE_REF_MAX_LENGTH = 512;
export const CORRECTION_REASON_MIN_LENGTH = 1;
export const CORRECTION_REASON_MAX_LENGTH = 512;
export const LATENESS_MINUTES_MIN = 0;
export const LATENESS_MINUTES_MAX = 1440;
export const BULK_MARKS_MIN_COUNT = 1;
export const BULK_MARKS_MAX_COUNT = 200;

// --- Bounded read limits -----------------------------------------------------
export const ATTENDANCE_HISTORY_SCAN_LIMIT = 500;
export const PARTICIPATION_SCAN_LIMIT = 2000;

// --- Scoring rule ------------------------------------------------------------
// The single seeded legacy-candidate rule (see legacy-business-rules.yaml). It is
// data in a table, never a hard-coded constant, and is a CANDIDATE — not approved
// policy — until an explicit approved version exists.
export const LEGACY_SCORING_RULE_CODE = 'legacy-candidate-v1';

// --- Domain event envelope ---------------------------------------------------
export const ATTENDANCE_AGGREGATE_TYPE = 'attendance_sheet';
export const ATTENDANCE_EVENT_VERSION = 1;
export const ATTENDANCE_FINALIZED_EVENT = 'attendance.finalized';
export const ATTENDANCE_CORRECTED_EVENT = 'attendance.corrected';
// Payload key the platform notification projector reads to target a recipient
// other than the actor (mirrors the platform RECIPIENT_PAYLOAD_KEY convention) so a
// correction reaches the affected member through outbox + notification preferences.
export const ATTENDANCE_RECIPIENT_KEY = 'recipientUserId';

// --- Audit actions -----------------------------------------------------------
export const ATTENDANCE_RECORDED_ACTION = 'practice.attendanceRecorded';
export const ATTENDANCE_BULK_RECORDED_ACTION =
  'practice.attendanceBulkRecorded';
export const ATTENDANCE_CHECKED_IN_ACTION = 'practice.attendanceCheckedIn';
export const ATTENDANCE_FINALIZED_ACTION = 'practice.attendanceFinalized';
export const ATTENDANCE_CORRECTED_ACTION = 'practice.attendanceCorrected';
export const ATTENDANCE_RECORD_RESOURCE_TYPE = 'attendance_record';
export const ATTENDANCE_SHEET_RESOURCE_TYPE = 'attendance_sheet';

// --- Static read-column lists (never interpolate caller input) ----------------
export const ATTENDANCE_SHEET_COLUMNS = `"id", "session_id", "team_id",
  "season_id", "state", "finalized_at", "finalized_by", "created_by",
  "updated_by", "created_at", "updated_at", "version"`;

export const ATTENDANCE_RECORD_COLUMNS = `"id", "sheet_id", "session_id",
  "team_id", "season_id", "membership_id", "user_id", "status", "check_in_at",
  "check_out_at", "lateness_minutes", "excuse_category", "note", "evidence_ref",
  "source", "recorded_by", "recorded_at", "created_by", "updated_by",
  "created_at", "updated_at", "version"`;

export const ATTENDANCE_REVISION_COLUMNS = `"id", "record_id", "session_id",
  "membership_id", "from_status", "to_status", "lateness_minutes",
  "excuse_category", "source", "is_correction", "correction_reason",
  "actor_user_id", "occurred_at"`;

export const ATTENDANCE_RULE_COLUMNS = `"code", "status", "weights",
  "default_weight", "late_penalty", "absent_penalty", "excused_excluded"`;

// --- Error messages & keys ---------------------------------------------------
export const ATTENDANCE_LOCKED_MESSAGE =
  'Attendance for this session is finalized; use a correction instead';
export const ATTENDANCE_LOCKED_MESSAGE_KEY: ErrorMessageKey =
  'errors.practices.attendanceLocked';

export const ATTENDANCE_SHEET_NOT_FOUND_MESSAGE =
  'No attendance has been recorded for this session yet';
export const ATTENDANCE_SHEET_NOT_FOUND_MESSAGE_KEY: ErrorMessageKey =
  'errors.practices.attendanceSheetNotFound';

export const ATTENDANCE_INVALID_TRANSITION_MESSAGE =
  'The attendance finalize/correct action is not allowed from its current state';
export const ATTENDANCE_INVALID_TRANSITION_MESSAGE_KEY: ErrorMessageKey =
  'errors.practices.invalidAttendanceTransition';

export const ATTENDANCE_MEMBERSHIP_NOT_FOUND_MESSAGE =
  'The membership was not found in this team scope';
export const ATTENDANCE_MEMBERSHIP_NOT_FOUND_MESSAGE_KEY: ErrorMessageKey =
  'errors.practices.attendanceMembershipNotFound';

export const ATTENDANCE_NOT_MEMBER_MESSAGE =
  'You are not an active member of this team';
export const ATTENDANCE_NOT_MEMBER_MESSAGE_KEY: ErrorMessageKey =
  'errors.practices.attendanceNotMember';

export const ATTENDANCE_INVALID_INPUT_MESSAGE =
  'The attendance mark is inconsistent with its status';
export const ATTENDANCE_INVALID_INPUT_MESSAGE_KEY: ErrorMessageKey =
  'errors.practices.invalidAttendanceInput';

export const ATTENDANCE_RULE_MISSING_MESSAGE =
  'No default attendance scoring rule is configured';
export const ATTENDANCE_RULE_MISSING_MESSAGE_KEY: ErrorMessageKey =
  'errors.practices.attendanceRuleMissing';
