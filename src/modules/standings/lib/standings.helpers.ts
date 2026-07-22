import {
  LIST_DEFAULT_LIMIT,
  LIST_DEFAULT_OFFSET,
  LIST_MAX_LIMIT,
  STANDINGS_DEFAULT_LIMIT,
  STANDINGS_MAX_LIMIT,
} from '../model/standings.constants';
import type { PageRequest } from '../model/standings.types';

/** Clamp caller-supplied paging to the module's bounded window. */
export function resolveStandingsPage(
  limit: number | undefined,
  offset: number | undefined,
): PageRequest {
  return {
    limit: Math.min(limit ?? LIST_DEFAULT_LIMIT, LIST_MAX_LIMIT),
    offset: offset ?? LIST_DEFAULT_OFFSET,
  };
}

/** Clamp paging for a standings table, which reads a larger page. */
export function resolveTablePage(
  limit: number | undefined,
  offset: number | undefined,
): PageRequest {
  return {
    limit: Math.min(limit ?? STANDINGS_DEFAULT_LIMIT, STANDINGS_MAX_LIMIT),
    offset: offset ?? LIST_DEFAULT_OFFSET,
  };
}

export function toDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

export function toNullableDate(value: string | Date | null): Date | null {
  return value === null ? null : toDate(value);
}

export function toNumber(value: string | number): number {
  return typeof value === 'number' ? value : Number(value);
}

export function toNullableNumber(value: string | number | null): number | null {
  return value === null ? null : toNumber(value);
}

/**
 * Render a stored `date` column as an ISO calendar day. A `date` has no instant
 * and no zone: it is presented as written so a Cairo-local achievement date can
 * never drift by a day through a UTC conversion.
 */
export function toCalendarDay(value: string | Date): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return value.slice(0, 10);
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

export function parseEnumValues<TValue extends string>(
  values: readonly TValue[],
  raw: readonly string[],
  label: string,
): readonly TValue[] {
  return raw.map(entry => parseEnumValue(values, entry, label));
}
