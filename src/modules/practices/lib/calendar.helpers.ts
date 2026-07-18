import {
  CALENDAR_FEED_LOOKAHEAD_DAYS,
  CALENDAR_FEED_LOOKBACK_DAYS,
  CALENDAR_TOKEN_TTL_DAYS_DEFAULT,
} from '../model/calendar.constants';
import type {
  CalendarFeedWindow,
  CreateCalendarFeedCommand,
} from '../model/calendar.types';
import { DEFAULT_TIMEZONE } from '../model/practices.constants';

export function resolveCalendarTimezone(
  command: CreateCalendarFeedCommand,
): string {
  return command.timezone ?? DEFAULT_TIMEZONE;
}

export function resolveCalendarExpiry(
  now: Date,
  command: CreateCalendarFeedCommand,
): Date {
  return addDays(now, command.expiresInDays ?? CALENDAR_TOKEN_TTL_DAYS_DEFAULT);
}

export function calendarFeedWindow(now: Date): CalendarFeedWindow {
  return {
    from: addDays(now, -CALENDAR_FEED_LOOKBACK_DAYS),
    to: addDays(now, CALENDAR_FEED_LOOKAHEAD_DAYS),
  };
}

export function isValidIanaTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format();
    return true;
  } catch (error: unknown) {
    return !(error instanceof RangeError);
  }
}

function addDays(value: Date, days: number): Date {
  const result = new Date(value);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}
