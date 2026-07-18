import {
  DATE_PATTERN,
  LIST_DEFAULT_LIMIT,
  LIST_DEFAULT_OFFSET,
  LIST_MAX_LIMIT,
  LOCAL_TIME_PATTERN,
  WEEKDAY_MAX,
  WEEKDAY_MIN,
} from '../model/practices.constants';
import type {
  RecurrenceFrequency,
  ScheduleStatus,
  SessionStatus,
  SessionVisibility,
} from '../model/practices.enums';
import {
  RECURRENCE_FREQUENCY_VALUES,
  RecurrenceFrequency as Frequency,
  SCHEDULE_STATUS_VALUES,
  SESSION_STATUS_VALUES,
  SESSION_VISIBILITY_VALUES,
} from '../model/practices.enums';
import type {
  CreateScheduleCommand,
  PageRequest,
  SessionListFilter,
  SessionListQuery,
  SessionWindow,
} from '../model/practices.types';
import { addMinutes, combineLocalDateTimeToUtc } from './cairo-time';

/** Convert a non-null timestamptz value to a Date. */
export function toDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

/** Convert a nullable timestamptz value to a Date or null (null-preserving). */
export function toNullableDate(value: string | Date | null): Date | null {
  if (value === null) {
    return null;
  }
  return value instanceof Date ? value : new Date(value);
}

/**
 * True when `value` is a real calendar date in strict `YYYY-MM-DD` form. Rejects
 * malformed strings and impossible dates (e.g. 2026-02-31) so they surface as a
 * clean 400 rather than a database coercion.
 */
export function isIsoCalendarDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) {
    return false;
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    return false;
  }
  return value === parsed.toISOString().slice(0, 10);
}

/** True when `value` is a 24-hour `HH:MM` wall-clock time. */
export function isValidLocalTime(value: string): boolean {
  return LOCAL_TIME_PATTERN.test(value);
}

/** Clamp a caller-supplied page window to safe, bounded values. */
export function resolvePage(
  limit: number | undefined,
  offset: number | undefined,
): PageRequest {
  const boundedLimit = Math.min(limit ?? LIST_DEFAULT_LIMIT, LIST_MAX_LIMIT);
  return {
    limit: Math.max(boundedLimit, 1),
    offset: Math.max(offset ?? LIST_DEFAULT_OFFSET, 0),
  };
}

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

export function parseSessionStatus(raw: string): SessionStatus {
  return parseEnum(SESSION_STATUS_VALUES, raw, 'session status');
}

export function parseScheduleStatus(raw: string): ScheduleStatus {
  return parseEnum(SCHEDULE_STATUS_VALUES, raw, 'schedule status');
}

export function parseVisibility(raw: string): SessionVisibility {
  return parseEnum(SESSION_VISIBILITY_VALUES, raw, 'visibility');
}

export function parseFrequency(raw: string): RecurrenceFrequency {
  return parseEnum(RECURRENCE_FREQUENCY_VALUES, raw, 'frequency');
}

function areWeekdaysValid(weekdays: readonly number[]): boolean {
  return weekdays.every(
    day => Number.isInteger(day) && day >= WEEKDAY_MIN && day <= WEEKDAY_MAX,
  );
}

function areDatesValid(command: CreateScheduleCommand): boolean {
  return (
    isIsoCalendarDate(command.generationStart) &&
    isIsoCalendarDate(command.generationUntil) &&
    command.generationStart <= command.generationUntil &&
    command.exceptions.every(date => isIsoCalendarDate(date))
  );
}

/**
 * Cross-field validity of a schedule command the DTO bounds cannot express: a
 * real start time, a valid ordered horizon, valid exception dates, valid
 * weekdays, and a weekday selection consistent with the chosen frequency (weekly
 * requires at least one weekday; a one-off must not carry weekdays).
 */
export function isValidScheduleCommand(
  command: CreateScheduleCommand,
): boolean {
  if (!isValidLocalTime(command.startTimeLocal) || !areDatesValid(command)) {
    return false;
  }
  if (!areWeekdaysValid(command.weekdays)) {
    return false;
  }
  if (command.frequency === Frequency.Weekly) {
    return command.weekdays.length > 0;
  }
  return command.weekdays.length === 0;
}

/**
 * Resolve a calendar/list query into a bounded, allowlisted session filter. The
 * window bounds parse to instants; absent dimensions become null (unfiltered);
 * pagination is clamped. Only these fixed dimensions are ever filterable.
 */
export function resolveSessionFilter(
  query: SessionListQuery,
): SessionListFilter {
  const page = resolvePage(query.limit, query.offset);
  return {
    from: query.from === undefined ? null : new Date(query.from),
    to: query.to === undefined ? null : new Date(query.to),
    status: query.status ?? null,
    sessionType: query.sessionType ?? null,
    seasonId: query.seasonId ?? null,
    limit: page.limit,
    offset: page.offset,
  };
}

/**
 * Resolve the UTC window for a single occurrence: combine the local date and
 * start time in the schedule timezone into the start instant, then derive the
 * end, meet, and RSVP-cutoff instants. Null offsets stay null (null-not-zero).
 */
export function resolveOccurrenceWindow(
  occurrenceDate: string,
  startTimeLocal: string,
  durationMinutes: number,
  meetOffsetMinutes: number | null,
  rsvpCutoffMinutes: number | null,
  timezone: string,
): SessionWindow {
  const startsAt = combineLocalDateTimeToUtc(
    occurrenceDate,
    startTimeLocal,
    timezone,
  );
  return {
    startsAt,
    endsAt: addMinutes(startsAt, durationMinutes),
    meetAt:
      meetOffsetMinutes === null
        ? null
        : addMinutes(startsAt, -meetOffsetMinutes),
    rsvpCutoffAt:
      rsvpCutoffMinutes === null
        ? null
        : addMinutes(startsAt, -rsvpCutoffMinutes),
  };
}
