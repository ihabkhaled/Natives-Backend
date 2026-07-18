import {
  MAX_GENERATED_OCCURRENCES,
  MAX_HORIZON_DAYS,
} from '../model/practices.constants';
import { RecurrenceFrequency } from '../model/practices.enums';
import type { RecurrenceRule } from '../model/practices.types';

/**
 * Pure recurrence expansion. Produces the ordered list of local calendar dates
 * (`YYYY-MM-DD`) a schedule occurs on within its bounded horizon, applying
 * weekday selection, week-interval alignment, and exceptions. Weekdays are
 * 0=Sunday … 6=Saturday. A calendar date's weekday is timezone-independent, so
 * this stays pure and deterministic; the UTC instant of each occurrence is
 * resolved later from the schedule timezone. Generation is bounded by both a
 * horizon-day cap and an occurrence cap so it can never fan out unbounded rows.
 */

const MS_PER_DAY = 86_400_000;

function toUtcMillis(date: string): number {
  return new Date(`${date}T00:00:00.000Z`).getTime();
}

/** The weekday (0=Sunday … 6=Saturday) of a `YYYY-MM-DD` calendar date. */
export function localWeekday(date: string): number {
  return new Date(`${date}T00:00:00.000Z`).getUTCDay();
}

/** Add `days` whole days to a `YYYY-MM-DD` date, returning `YYYY-MM-DD`. */
export function addDays(date: string, days: number): string {
  const shifted = new Date(toUtcMillis(date) + days * MS_PER_DAY);
  return shifted.toISOString().slice(0, 10);
}

/** Whole days from `start` to `end` (negative when `end` precedes `start`). */
export function daysBetween(start: string, end: string): number {
  return Math.round((toUtcMillis(end) - toUtcMillis(start)) / MS_PER_DAY);
}

function weekIndex(start: string, date: string): number {
  return Math.floor(daysBetween(start, date) / 7);
}

function isWeeklyMatch(rule: RecurrenceRule, date: string): boolean {
  if (!rule.weekdays.includes(localWeekday(date))) {
    return false;
  }
  return weekIndex(rule.generationStart, date) % rule.intervalWeeks === 0;
}

/**
 * Expand the rule into occurrence dates. A one-off yields its single start date
 * (unless excepted); a weekly rule fans out onto its selected weekdays across the
 * horizon. The returned list is ascending, de-duplicated by construction, and
 * capped at `MAX_GENERATED_OCCURRENCES`.
 */
export function generateOccurrenceDates(
  rule: RecurrenceRule,
): readonly string[] {
  const exceptions = new Set(rule.exceptions);
  if (rule.frequency === RecurrenceFrequency.OneOff) {
    return exceptions.has(rule.generationStart) ? [] : [rule.generationStart];
  }
  const occurrences: string[] = [];
  const horizonDays = Math.min(
    daysBetween(rule.generationStart, rule.generationUntil),
    MAX_HORIZON_DAYS,
  );
  for (let offset = 0; offset <= horizonDays; offset += 1) {
    if (occurrences.length >= MAX_GENERATED_OCCURRENCES) {
      break;
    }
    const date = addDays(rule.generationStart, offset);
    if (!exceptions.has(date) && isWeeklyMatch(rule, date)) {
      occurrences.push(date);
    }
  }
  return occurrences;
}
