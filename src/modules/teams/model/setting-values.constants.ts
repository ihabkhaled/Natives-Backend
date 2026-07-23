import { AttendanceStatus } from '../../practices/model/attendance.enums';

/**
 * Bounds, patterns and constraint codes for typed team-setting values (P2).
 * The domain policy (`domain/setting-value.policy.ts`) enforces these; the value
 * DTOs under `api/dto/setting-values/` mirror them into the OpenAPI contract so
 * documentation, generated clients and enforcement stay 1:1.
 */

// --- Shared shape rules -------------------------------------------------------
// Identifier codes: lowercase snake, 2–32 chars, letter first. Both quantifiers
// are flat (ReDoS-safe).
export const SETTING_CODE_PATTERN = /^[a-z][a-z0-9_]{1,31}$/u;
export const SETTING_LABEL_MIN_LENGTH = 1;
export const SETTING_LABEL_MAX_LENGTH = 60;

// Strict UTC instant: full ISO-8601 date-time with an explicit `Z` designator
// and optional 1–3 digit fraction. Offsets (`+02:00`) and offset-less local
// strings are rejected at the edge (D5). Two flat alternatives keep every
// quantifier un-nested (ReDoS-safe), mirroring SLUG_PATTERN.
export const UTC_INSTANT_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$|^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{1,3}Z$/u;

// --- attendance_statuses ------------------------------------------------------
export const ATTENDANCE_STATUS_ENTRIES_MIN = 1;
export const ATTENDANCE_STATUS_ENTRIES_MAX = 7;
/** Both poles a usable attendance sheet needs, each required and active (D2). */
export const REQUIRED_STATUS_POLES: readonly AttendanceStatus[] = [
  AttendanceStatus.PresentOnTime,
  AttendanceStatus.Absent,
];
/**
 * Present-family codes used by the absent-weight sanity rule: an `absent`
 * weight may never exceed any present-family weight (inverted weighting).
 */
export const PRESENT_FAMILY_STATUS_CODES: readonly AttendanceStatus[] = [
  AttendanceStatus.PresentOnTime,
  AttendanceStatus.PresentLate,
  AttendanceStatus.RemoteApproved,
  AttendanceStatus.OtherApproved,
];

// --- session_types ------------------------------------------------------------
export const SESSION_TYPES_MIN = 1;
export const SESSION_TYPES_MAX = 24;
export const SESSION_DURATION_MIN_MINUTES = 15;
export const SESSION_DURATION_MAX_MINUTES = 480;

// --- attendance_weights -------------------------------------------------------
export const ATTENDANCE_WEIGHT_MIN = 0;
export const ATTENDANCE_WEIGHT_MAX = 1;
/** Weights carry at most 3 decimal places: value × 1000 must be an integer. */
export const ATTENDANCE_WEIGHT_SCALE = 1000;
/** Float tolerance when checking the ×1000 integrality of a weight. */
export const ATTENDANCE_WEIGHT_EPSILON = 1e-9;

// --- assessment_scale ---------------------------------------------------------
export const ASSESSMENT_SCALE_FLOOR = 0;
export const ASSESSMENT_SCALE_CEILING = 100;
export const ASSESSMENT_SCALE_STEP_MIN = 1;
export const ASSESSMENT_BANDS_MAX = 10;

// --- badge_tiers --------------------------------------------------------------
export const BADGE_TIERS_MIN = 1;
export const BADGE_TIERS_MAX = 10;
export const BADGE_THRESHOLD_MIN = 0;
export const BADGE_THRESHOLD_MAX = 100000;

// --- roster_limits ------------------------------------------------------------
export const ROSTER_SIZE_MAX = 100;
/** Ultimate fields 7 a line — a match squad below 7 cannot field a line. */
export const MATCH_SQUAD_MIN_FLOOR = 7;

// --- notification_rules -------------------------------------------------------
export const LEAD_HOURS_MIN = 1;
export const LEAD_HOURS_MAX = 168;
// "HH:mm" 24-hour Cairo wall time; flat alternation, ReDoS-safe.
export const QUIET_HOURS_TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/u;

// --- report_branding ----------------------------------------------------------
export const BRANDING_DISPLAY_NAME_MIN_LENGTH = 1;
export const BRANDING_DISPLAY_NAME_MAX_LENGTH = 80;
export const BRANDING_FOOTER_MAX_LENGTH = 200;
export const BRANDING_ACCENT_PATTERN = /^#[0-9a-fA-F]{6}$/u;
export const BRANDING_EMAIL_MAX_LENGTH = 254;
// Deliberately simple, linear email shape check for a pure domain policy.
export const BRANDING_EMAIL_PATTERN = /^[^\s@]+@[^\s@][^\s.@]*\.[^\s@]+$/u;
export const BRANDING_LOGO_KEY_MIN_LENGTH = 1;
export const BRANDING_LOGO_KEY_MAX_LENGTH = 200;

// --- Constraint codes (stable, machine-readable; mirrored by the frontend) ----
export const SETTING_VALUE_CONSTRAINTS = {
  notAnObject: 'not_an_object',
  unexpectedProperty: 'unexpected_property',
  missingProperty: 'missing_property',
  invalidType: 'invalid_type',
  invalidCode: 'invalid_code',
  duplicateCode: 'duplicate_code',
  invalidLabel: 'invalid_label',
  invalidColor: 'invalid_color',
  missingPole: 'missing_pole',
  noMetricStatus: 'no_metric_status',
  noActiveEntry: 'no_active_entry',
  tooFewEntries: 'too_few_entries',
  tooManyEntries: 'too_many_entries',
  outOfRange: 'out_of_range',
  tooManyDecimals: 'too_many_decimals',
  minNotBelowMax: 'min_not_below_max',
  stepNotDivisor: 'step_not_divisor',
  bandOutsideScale: 'band_outside_scale',
  bandOverlap: 'band_overlap',
  thresholdNotAscending: 'threshold_not_ascending',
  squadExceedsRoster: 'squad_exceeds_roster',
  squadBelowLine: 'squad_below_line',
  positionCapBelowSquadMin: 'position_cap_below_squad_min',
  unknownEvent: 'unknown_event',
  duplicateEvent: 'duplicate_event',
  noChannel: 'no_channel',
  duplicateChannel: 'duplicate_channel',
  leadHoursRequired: 'lead_hours_required',
  leadHoursForbidden: 'lead_hours_forbidden',
  quietHoursEqual: 'quiet_hours_equal',
  invalidTime: 'invalid_time',
  blankText: 'blank_text',
  invalidAccentColor: 'invalid_accent_color',
  invalidEmail: 'invalid_email',
  // Cross-reference constraints (write-time) and snapshot issue prefixes.
  statusesNotConfigured: 'statuses_not_configured',
  weightsUnknownStatus: 'weights_unknown_status',
  weightsMissingStatus: 'weights_missing_status',
  absentWeightExceedsPresent: 'absent_weight_exceeds_present',
  unknownPosition: 'unknown_position',
} as const;

/** Separator between an issue code and its subject (`weights_missing_status:absent`). */
export const CONSTRAINT_SUBJECT_SEPARATOR = ':';
