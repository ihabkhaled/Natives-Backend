import type { ErrorMessageKey } from '@core/errors/error.types';

// --- Routes & OpenAPI tag ----------------------------------------------------
export const DASHBOARD_ROUTE = 'dashboard';
export const DASHBOARD_API_TAG = 'dashboard';
export const DASHBOARD_SUMMARY_ROUTE = 'summary';

// --- i18n keys the client resolves (never raw server copy) -------------------
export const DASHBOARD_LABEL_KEYS = {
  attendancePresent: 'dashboard.attendancePresent',
  attendanceLate: 'dashboard.attendanceLate',
  attendanceExcused: 'dashboard.attendanceExcused',
  attendanceAbsent: 'dashboard.attendanceAbsent',
  taskConfirmPractice: 'dashboard.taskConfirmPractice',
  taskRsvpMatch: 'dashboard.taskRsvpMatch',
  taskReviewFeedback: 'dashboard.taskReviewFeedback',
  taskPlanSession: 'dashboard.taskPlanSession',
  taskFinalizeAttendance: 'dashboard.taskFinalizeAttendance',
  taskCompleteAssessments: 'dashboard.taskCompleteAssessments',
  taskUpdateRoster: 'dashboard.taskUpdateRoster',
  taskReviewInvitations: 'dashboard.taskReviewInvitations',
} as const;

// --- Attendance breakdown ----------------------------------------------------
// The statuses the member attendance widget always shows, in display order. A
// status the member has never been marked with renders as null, not zero.
export const ATTENDANCE_BREAKDOWN_KEYS: readonly string[] = [
  'present',
  'late',
  'excused',
  'absent',
];

export const ATTENDANCE_LABEL_KEY_BY_STATUS: ReadonlyMap<string, string> =
  new Map([
    ['present', DASHBOARD_LABEL_KEYS.attendancePresent],
    ['late', DASHBOARD_LABEL_KEYS.attendanceLate],
    ['excused', DASHBOARD_LABEL_KEYS.attendanceExcused],
    ['absent', DASHBOARD_LABEL_KEYS.attendanceAbsent],
  ]);

// --- Task identifiers (stable, client-visible) -------------------------------
export const DASHBOARD_TASK_IDS = {
  sessionPrefix: 'session',
  reviewFeedback: 'review-feedback',
  planSessions: 'plan-sessions',
  finalizeAttendance: 'finalize-attendance',
  completeAssessments: 'complete-assessments',
  updateRoster: 'update-roster',
  reviewInvitations: 'review-invitations',
} as const;

// --- Tone thresholds ---------------------------------------------------------
// Whole-percent boundaries for profile completeness, and backlog sizes at which
// a coach/admin queue stops being routine. Data, not scattered conditionals.
export const COMPLETENESS_POSITIVE_MIN_PERCENT = 80;
export const COMPLETENESS_ATTENTION_MIN_PERCENT = 50;
export const BACKLOG_CRITICAL_MIN_COUNT = 5;
export const BACKLOG_ATTENTION_MIN_COUNT = 1;
export const STANDING_PODIUM_MAX_RANK = 3;

// --- Error messages & keys ---------------------------------------------------
export const DASHBOARD_TEAM_FORBIDDEN_MESSAGE =
  'You do not have a membership in the requested team';
export const DASHBOARD_TEAM_FORBIDDEN_MESSAGE_KEY: ErrorMessageKey =
  'errors.dashboard.teamForbidden';
