import {
  allowsExcuseCategory,
  allowsLateness,
} from '../domain/attendance-status.policy';
import {
  LATENESS_MINUTES_MAX,
  MS_PER_MINUTE,
} from '../model/attendance.constants';
import {
  ATTENDANCE_EXCUSE_CATEGORY_VALUES,
  ATTENDANCE_RULE_STATUS_VALUES,
  ATTENDANCE_SOURCE_VALUES,
  ATTENDANCE_STATE_VALUES,
  ATTENDANCE_STATUS_VALUES,
  type AttendanceExcuseCategory,
  type AttendanceRuleStatus,
  type AttendanceSource,
  type AttendanceState,
  AttendanceStatus,
} from '../model/attendance.enums';
import type {
  AttendanceListQuery,
  SelfCheckInDerivation,
  SelfHistoryQueryInput,
  SelfHistoryRequest,
} from '../model/attendance.types';
import type { PageRequest } from '../model/practices.types';
import { resolvePage } from './practices.helpers';

function parseEnum<TValue extends string>(
  values: readonly TValue[],
  raw: string,
  label: string,
): TValue {
  const match = values.find(value => value === raw);
  if (match === undefined) {
    throw new Error(`Unrecognized ${label} value: ${raw}`);
  }
  return match;
}

/** Map a persisted status string to the AttendanceStatus enum (rejects unknowns). */
export function parseAttendanceStatus(raw: string): AttendanceStatus {
  return parseEnum(ATTENDANCE_STATUS_VALUES, raw, 'attendance status');
}

/** Map a nullable persisted status string to AttendanceStatus or null. */
export function parseNullableAttendanceStatus(
  raw: string | null,
): AttendanceStatus | null {
  return raw === null ? null : parseAttendanceStatus(raw);
}

/** Map a persisted state string to the AttendanceState enum. */
export function parseAttendanceState(raw: string): AttendanceState {
  return parseEnum(ATTENDANCE_STATE_VALUES, raw, 'attendance state');
}

/** Map a nullable persisted state string to AttendanceState or null. */
export function parseNullableAttendanceState(
  raw: string | null,
): AttendanceState | null {
  return raw === null ? null : parseAttendanceState(raw);
}

/** Map a persisted source string to the AttendanceSource enum. */
export function parseAttendanceSource(raw: string): AttendanceSource {
  return parseEnum(ATTENDANCE_SOURCE_VALUES, raw, 'attendance source');
}

/** Map a nullable persisted source string to AttendanceSource or null. */
export function parseNullableAttendanceSource(
  raw: string | null,
): AttendanceSource | null {
  return raw === null ? null : parseAttendanceSource(raw);
}

/** Map a nullable persisted excuse string to AttendanceExcuseCategory or null. */
export function parseExcuseCategory(
  raw: string | null,
): AttendanceExcuseCategory | null {
  return raw === null
    ? null
    : parseEnum(
        ATTENDANCE_EXCUSE_CATEGORY_VALUES,
        raw,
        'attendance excuse category',
      );
}

/** Map a persisted rule-status string to the AttendanceRuleStatus enum. */
export function parseRuleStatus(raw: string): AttendanceRuleStatus {
  return parseEnum(
    ATTENDANCE_RULE_STATUS_VALUES,
    raw,
    'attendance rule status',
  );
}

/** Coerce a jsonb weights blob into a `sessionType → weight` scalar map. */
export function parseWeights(raw: unknown): Record<string, number> {
  if (raw === null || typeof raw !== 'object') {
    return {};
  }
  const result: Record<string, number> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      result[key.toLowerCase()] = value;
    }
  }
  return result;
}

/** Clamp a caller-supplied attendance list page to safe, bounded values. */
export function resolveAttendancePage(query: AttendanceListQuery): PageRequest {
  return resolvePage(query.limit, query.offset);
}

/** Resolve the self-history query into a season filter + clamped page. */
export function resolveSelfHistoryRequest(
  query: SelfHistoryQueryInput,
): SelfHistoryRequest {
  return {
    seasonId: query.seasonId ?? null,
    page: resolvePage(query.limit, query.offset),
  };
}

/**
 * Derive a self check-in status from the clock: on-time when the member checks in
 * at or before the session start, otherwise present-late with measured lateness
 * minutes (clamped, at least one minute). Lateness stays null for an on-time
 * check-in (null-not-zero: on-time is not a measured "0 minutes late").
 */
export function deriveCheckInStatus(
  now: Date,
  startsAt: Date,
): SelfCheckInDerivation {
  const diffMs = now.getTime() - startsAt.getTime();
  if (diffMs <= 0) {
    return { status: AttendanceStatus.PresentOnTime, latenessMinutes: null };
  }
  const minutes = Math.max(1, Math.ceil(diffMs / MS_PER_MINUTE));
  return {
    status: AttendanceStatus.PresentLate,
    latenessMinutes: Math.min(minutes, LATENESS_MINUTES_MAX),
  };
}

/**
 * Cross-field consistency the DTO bounds cannot express: lateness minutes may only
 * accompany a present-late status, and an excuse category may only accompany an
 * excused/injured status. Everything else must be null for that status.
 */
export function isMarkConsistent(
  status: AttendanceStatus,
  latenessMinutes: number | null,
  excuseCategory: AttendanceExcuseCategory | null,
): boolean {
  if (latenessMinutes !== null && !allowsLateness(status)) {
    return false;
  }
  if (excuseCategory !== null && !allowsExcuseCategory(status)) {
    return false;
  }
  return true;
}

/** True when a bulk mark list contains a duplicate membership id. */
export function hasDuplicateMembership(
  membershipIds: readonly string[],
): boolean {
  return new Set(membershipIds).size !== membershipIds.length;
}

/** Serialize a nullable instant to an ISO-8601 string or null for binding. */
export function toIsoOrNull(value: Date | null): string | null {
  return value === null ? null : value.toISOString();
}

/** Parse an optional ISO-8601 instant string to a Date, or null when absent. */
export function parseNullableInstant(value: string | undefined): Date | null {
  return value === undefined ? null : new Date(value);
}
