import {
  DAYS_PER_WEEK,
  LEADERBOARD_TIME_ZONE,
  MONTHS_PER_YEAR,
  WEEK_START_DOW,
} from '../model/leaderboard.constants';
import { LeaderboardPeriod } from '../model/leaderboard.enums';
import type {
  LeaderboardWindows,
  SeasonBounds,
} from '../model/leaderboard.types';

/**
 * Pure resolution of a leaderboard's scored window from an Africa/Cairo calendar.
 * Weekly and monthly edges are computed in Cairo wall-clock time and converted to
 * unambiguous UTC instants (via the platform ICU database, so DST is handled and
 * no timezone tables are hand-maintained), so an award near a Cairo month boundary
 * lands in exactly the period its Cairo-local instant falls in. No side effects,
 * no clock, no persistence — the reference instant is always injected.
 */

interface CalendarDate {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

function cairoFormatter(): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: LEADERBOARD_TIME_ZONE,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/** Read one numeric field from formatted parts (0 when absent). */
export function readPart(
  parts: readonly Intl.DateTimeFormatPart[],
  type: string,
): number {
  const match = parts.find(part => part.type === type);
  return match === undefined ? 0 : Number(match.value);
}

/** The Cairo wall-clock calendar date of a UTC instant. */
export function cairoDateParts(instant: Date): CalendarDate {
  const parts = cairoFormatter().formatToParts(instant);
  return {
    year: readPart(parts, 'year'),
    month: readPart(parts, 'month'),
    day: readPart(parts, 'day'),
  };
}

/** Offset (Cairo wall-clock − UTC) in ms that applies at `instant`. */
export function cairoOffsetMs(instant: Date): number {
  const parts = cairoFormatter().formatToParts(instant);
  const asUtc = Date.UTC(
    readPart(parts, 'year'),
    readPart(parts, 'month') - 1,
    readPart(parts, 'day'),
    readPart(parts, 'hour'),
    readPart(parts, 'minute'),
    readPart(parts, 'second'),
  );
  return asUtc - instant.getTime();
}

/** Resolve a Cairo midnight-of-date to its UTC instant (two-pass DST safe). */
export function cairoMidnightUtc(date: CalendarDate): Date {
  const naiveUtc = Date.UTC(date.year, date.month - 1, date.day);
  const firstOffset = cairoOffsetMs(new Date(naiveUtc));
  const candidate = new Date(naiveUtc - firstOffset);
  const secondOffset = cairoOffsetMs(candidate);
  if (secondOffset === firstOffset) {
    return candidate;
  }
  return new Date(naiveUtc - secondOffset);
}

/** Shift a calendar date by whole days, rolling months/years correctly. */
export function shiftDate(date: CalendarDate, deltaDays: number): CalendarDate {
  const shifted = new Date(
    Date.UTC(date.year, date.month - 1, date.day + deltaDays),
  );
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

function firstOfMonth(date: CalendarDate): CalendarDate {
  return { year: date.year, month: date.month, day: 1 };
}

function firstOfNextMonth(date: CalendarDate): CalendarDate {
  if (date.month === MONTHS_PER_YEAR) {
    return { year: date.year + 1, month: 1, day: 1 };
  }
  return { year: date.year, month: date.month + 1, day: 1 };
}

function firstOfPreviousMonth(date: CalendarDate): CalendarDate {
  if (date.month === 1) {
    return { year: date.year - 1, month: MONTHS_PER_YEAR, day: 1 };
  }
  return { year: date.year, month: date.month - 1, day: 1 };
}

function weekStart(date: CalendarDate): CalendarDate {
  const dow = new Date(
    Date.UTC(date.year, date.month - 1, date.day),
  ).getUTCDay();
  const back = (dow - WEEK_START_DOW + DAYS_PER_WEEK) % DAYS_PER_WEEK;
  return shiftDate(date, -back);
}

function monthlyWindows(now: Date): LeaderboardWindows {
  const parts = cairoDateParts(now);
  const currentStart = cairoMidnightUtc(firstOfMonth(parts));
  return {
    current: {
      startUtc: currentStart,
      endUtc: cairoMidnightUtc(firstOfNextMonth(parts)),
    },
    previous: {
      startUtc: cairoMidnightUtc(firstOfPreviousMonth(parts)),
      endUtc: currentStart,
    },
  };
}

function weeklyWindows(now: Date): LeaderboardWindows {
  const start = weekStart(cairoDateParts(now));
  const currentStart = cairoMidnightUtc(start);
  return {
    current: {
      startUtc: currentStart,
      endUtc: cairoMidnightUtc(shiftDate(start, DAYS_PER_WEEK)),
    },
    previous: {
      startUtc: cairoMidnightUtc(shiftDate(start, -DAYS_PER_WEEK)),
      endUtc: currentStart,
    },
  };
}

function seasonWindows(season: SeasonBounds | null): LeaderboardWindows {
  if (season === null) {
    return allTimeWindows();
  }
  return {
    current: {
      startUtc: cairoMidnightUtc(parseIsoDate(season.startsOn)),
      endUtc: cairoMidnightUtc(shiftDate(parseIsoDate(season.endsOn), 1)),
    },
    previous: null,
  };
}

function allTimeWindows(): LeaderboardWindows {
  return { current: { startUtc: null, endUtc: null }, previous: null };
}

function parseIsoDate(iso: string): CalendarDate {
  return {
    year: Number(iso.slice(0, 4)),
    month: Number(iso.slice(5, 7)),
    day: Number(iso.slice(8, 10)),
  };
}

/** Resolve the current and comparable-previous windows for a period. */
export function computePeriodWindows(
  period: LeaderboardPeriod,
  now: Date,
  season: SeasonBounds | null,
): LeaderboardWindows {
  if (period === LeaderboardPeriod.Weekly) {
    return weeklyWindows(now);
  }
  if (period === LeaderboardPeriod.Monthly) {
    return monthlyWindows(now);
  }
  if (period === LeaderboardPeriod.Season) {
    return seasonWindows(season);
  }
  return allTimeWindows();
}
