import {
  LIST_DEFAULT_LIMIT,
  LIST_DEFAULT_OFFSET,
  LIST_MAX_LIMIT,
} from '../model/activities.constants';
import type { PageRequest } from '../model/activity.types';

/** Clamp caller-supplied paging to the module's bounded, deterministic window. */
export function resolveActivityPage(
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

export function toNullableNumber(value: string | null): number | null {
  return value === null ? null : Number(value);
}

/** The UTC calendar day (YYYY-MM-DD) of an instant — the server "today". */
export function toCalendarDay(now: Date): string {
  return now.toISOString().slice(0, 10);
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
