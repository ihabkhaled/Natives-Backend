import {
  EVENT_DEFAULT_LIMIT,
  EVENT_MAX_LIMIT,
  LIST_DEFAULT_LIMIT,
  LIST_DEFAULT_OFFSET,
  LIST_MAX_LIMIT,
} from '../model/matches.constants';
import type { PageRequest } from '../model/matches.types';

/** Clamp caller-supplied paging to the module's bounded, deterministic window. */
export function resolveMatchesPage(
  limit: number | undefined,
  offset: number | undefined,
): PageRequest {
  return {
    limit: Math.min(limit ?? LIST_DEFAULT_LIMIT, LIST_MAX_LIMIT),
    offset: offset ?? LIST_DEFAULT_OFFSET,
  };
}

/** Clamp paging for the append-only event feed, which allows a larger page. */
export function resolveEventsPage(
  limit: number | undefined,
  offset: number | undefined,
): PageRequest {
  return {
    limit: Math.min(limit ?? EVENT_DEFAULT_LIMIT, EVENT_MAX_LIMIT),
    offset: offset ?? LIST_DEFAULT_OFFSET,
  };
}

export function toDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

export function toNullableDate(value: string | Date | null): Date | null {
  return value === null ? null : toDate(value);
}

/** Coerce a numeric column (an integer may arrive as a string) to a number. */
export function toNumber(value: string | number): number {
  return typeof value === 'number' ? value : Number(value);
}

/** Coerce a nullable numeric column, preserving null as "does not apply". */
export function toNullableNumber(value: string | number | null): number | null {
  return value === null ? null : toNumber(value);
}

/** Serialize an instant for a parameterized write, preserving null. */
export function toInstant(value: Date | null): string | null {
  return value === null ? null : value.toISOString();
}

/** Parse a caller-supplied ISO instant, preserving null as "not recorded". */
export function toOptionalInstant(value: string | null): Date | null {
  return value === null ? null : new Date(value);
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

export function parseNullableEnumValue<TValue extends string>(
  values: readonly TValue[],
  raw: string | null,
  label: string,
): TValue | null {
  return raw === null ? null : parseEnumValue(values, raw, label);
}

/** Read an optional transport field, collapsing `undefined` onto null. */
export function orNull<TValue>(
  value: TValue | null | undefined,
): TValue | null {
  return value ?? null;
}

/** Read an optional transport field with an explicit, documented default. */
export function orDefault<TValue>(
  value: TValue | null | undefined,
  fallback: TValue,
): TValue {
  return value ?? fallback;
}
