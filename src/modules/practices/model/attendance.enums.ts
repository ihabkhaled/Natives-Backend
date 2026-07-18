/**
 * Enumerations for practice attendance (module 202). Attendance is the AUDITABLE
 * record of who actually took part in a session — deliberately separate from RSVP
 * intention (module 201) and from any computed score (the versioned scoring engine
 * is module 303; this module only ever exposes raw participation INPUTS). Every
 * enum ships a `*_VALUES` array so DTO validation and pure guards reference the
 * canonical set without re-listing literals. Values are the stable strings
 * persisted in the database.
 */

/**
 * A participant's effective attendance for one session. This is the configurable
 * target catalog from the product state machine; the legacy workbook codes map
 * onto it as P → `present_on_time`, L → `present_late`, E → `excused`/`injured`
 * (requires an explicit rule to resolve), A → `absent`. Approved remote/other
 * participation is recorded explicitly rather than being silently folded into
 * "present".
 */
export enum AttendanceStatus {
  PresentOnTime = 'present_on_time',
  PresentLate = 'present_late',
  Excused = 'excused',
  Injured = 'injured',
  Absent = 'absent',
  RemoteApproved = 'remote_approved',
  OtherApproved = 'other_approved',
}

export const ATTENDANCE_STATUS_VALUES: readonly AttendanceStatus[] =
  Object.values(AttendanceStatus);

/**
 * The finalization lifecycle of one session's attendance sheet. `Open` accepts new
 * marks and self check-ins; `Finalized` locks the sheet so further edits require
 * the correct permission; `Corrected` is the post-finalization state after at least
 * one audited correction. History is always preserved across every state.
 */
export enum AttendanceState {
  Open = 'open',
  Finalized = 'finalized',
  Corrected = 'corrected',
}

export const ATTENDANCE_STATE_VALUES: readonly AttendanceState[] =
  Object.values(AttendanceState);

/**
 * How an attendance record was captured: the participant themselves (self
 * check-in), a coach/admin mark or override, an import, or a system action. The
 * source is audited and drives the "self vs staff" distinction the product needs.
 */
export enum AttendanceSource {
  Self = 'self',
  Coach = 'coach',
  Admin = 'admin',
  Import = 'import',
  System = 'system',
}

export const ATTENDANCE_SOURCE_VALUES: readonly AttendanceSource[] =
  Object.values(AttendanceSource);

/**
 * Coarse, privacy-safe category explaining an excused or injured absence. Null when
 * unspecified (null-not-zero: an unspecified reason is never coerced to a default
 * bucket). Never placed in audit diffs or event payloads.
 */
export enum AttendanceExcuseCategory {
  Injury = 'injury',
  Illness = 'illness',
  Work = 'work',
  Travel = 'travel',
  Personal = 'personal',
  Other = 'other',
}

export const ATTENDANCE_EXCUSE_CATEGORY_VALUES: readonly AttendanceExcuseCategory[] =
  Object.values(AttendanceExcuseCategory);

/**
 * Approval status of a versioned attendance scoring rule. Legacy weights are
 * seeded as a `Candidate` only — never adopted as final policy without an explicit
 * approved version (see legacy-business-rules.yaml warnings).
 */
export enum AttendanceRuleStatus {
  Candidate = 'candidate',
  Approved = 'approved',
}

export const ATTENDANCE_RULE_STATUS_VALUES: readonly AttendanceRuleStatus[] =
  Object.values(AttendanceRuleStatus);
