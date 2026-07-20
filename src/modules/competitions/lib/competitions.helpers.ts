import {
  CAIRO_TIMEZONE,
  ISO_DATE_LENGTH,
  LIST_DEFAULT_LIMIT,
  LIST_DEFAULT_OFFSET,
  LIST_MAX_LIMIT,
} from '../model/competitions.constants';
import type { PageRequest } from '../model/competitions.types';

/** Clamp caller-supplied paging to the module's bounded, deterministic window. */
export function resolveCompetitionsPage(
  limit: number | undefined,
  offset: number | undefined,
): PageRequest {
  return {
    limit: Math.min(limit ?? LIST_DEFAULT_LIMIT, LIST_MAX_LIMIT),
    offset: offset ?? LIST_DEFAULT_OFFSET,
  };
}

export function toDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

export function toNullableDate(value: string | Date | null): Date | null {
  return value === null ? null : toDate(value);
}

export function parseEnumValue<TValue extends string>(
  values: readonly TValue[],
  raw: string,
  label: string,
): TValue {
  const value = values.find(candidate => candidate === raw);
  if (value === undefined) {
    throw new Error(`Unrecognized ${label}: ${raw}`);
  }
  return value;
}

/** Format an instant as the Africa/Cairo calendar day (YYYY-MM-DD). */
export function toCairoDateOnly(date: Date): string {
  return cairoParts(date).slice(0, ISO_DATE_LENGTH);
}

/** Present a UTC instant as the Africa/Cairo wall-clock time (YYYY-MM-DDTHH:mm). */
export function toCairoWallClock(date: Date): string {
  return cairoParts(date);
}

/** Deterministic Africa/Cairo `YYYY-MM-DDTHH:mm` rendering of an instant. */
function cairoParts(date: Date): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: CAIRO_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const lookup = new Map(parts.map(part => [part.type, part.value]));
  const year = lookup.get('year') ?? '0000';
  const month = lookup.get('month') ?? '01';
  const day = lookup.get('day') ?? '01';
  const hour = normalizeHour(lookup.get('hour') ?? '00');
  const minute = lookup.get('minute') ?? '00';
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

/** The `en-CA` formatter renders midnight as `24`; normalize it to `00`. */
function normalizeHour(hour: string): string {
  return hour === '24' ? '00' : hour;
}
