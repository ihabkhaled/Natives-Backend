import {
  LIST_DEFAULT_LIMIT,
  LIST_DEFAULT_OFFSET,
  LIST_MAX_LIMIT,
} from '../model/measurements.constants';
import type { PageRequest } from '../model/measurements.types';

/** Clamp caller-supplied paging to the module's bounded, deterministic window. */
export function resolveMeasurementsPage(
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

/**
 * Deterministic half-up rounding to a fixed number of decimals — used ONLY at the
 * presentation boundary so a derived result never claims false precision. Null
 * stays null (a missing value is never rounded to zero).
 */
export function roundNullable(
  value: number | null,
  decimals: number,
): number | null {
  if (value === null) {
    return null;
  }
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}
