import { AttendanceStatus } from '../model/attendance.enums';

/**
 * Pure classification of a participant attendance status. This is the single source
 * of truth for how each status feeds participation inputs — whether it counts as
 * attended, as an excused exclusion, or as an absence — and which fields a status
 * requires. No time, no persistence; every branch is unit-tested.
 */

const ATTENDED: ReadonlySet<AttendanceStatus> = new Set([
  AttendanceStatus.PresentOnTime,
  AttendanceStatus.PresentLate,
  AttendanceStatus.RemoteApproved,
  AttendanceStatus.OtherApproved,
]);

const EXCUSED: ReadonlySet<AttendanceStatus> = new Set([
  AttendanceStatus.Excused,
  AttendanceStatus.Injured,
]);

/** True when the status counts as the member having taken part (the numerator). */
export function isAttended(status: AttendanceStatus): boolean {
  return ATTENDED.has(status);
}

/** True for the excused/injured statuses (the excludable denominator inputs). */
export function isExcused(status: AttendanceStatus): boolean {
  return EXCUSED.has(status);
}

/** True only for an explicit absence. */
export function isAbsent(status: AttendanceStatus): boolean {
  return status === AttendanceStatus.Absent;
}

/** True only for a present-late status (the lateness-penalty input). */
export function isLate(status: AttendanceStatus): boolean {
  return status === AttendanceStatus.PresentLate;
}

/**
 * True when the status may legitimately carry lateness minutes. Only a present-late
 * mark carries measured lateness; any other status must leave lateness null
 * (null-not-zero — never invent a measured zero for an on-time or absent member).
 */
export function allowsLateness(status: AttendanceStatus): boolean {
  return isLate(status);
}

/**
 * True when the status may carry an excuse category. Only excused/injured marks
 * carry a coarse excuse category; any other status must leave it null.
 */
export function allowsExcuseCategory(status: AttendanceStatus): boolean {
  return isExcused(status);
}
