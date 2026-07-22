import {
  DIMENSION_DIRECTIONS,
  DIMENSION_UNITS,
  LIST_DEFAULT_LIMIT,
  LIST_DEFAULT_OFFSET,
  LIST_MAX_LIMIT,
} from '../model/analytics.constants';
import type { AnalyticsDimension } from '../model/analytics.enums';
import { AnalyticsDirection, AnalyticsUnit } from '../model/analytics.enums';
import type { PageRequest } from '../model/analytics.types';

export function resolveAnalyticsPage(
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

export function toNumber(value: string | number): number {
  return typeof value === 'number' ? value : Number(value);
}

export function toNullableNumber(value: string | number | null): number | null {
  return value === null ? null : toNumber(value);
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

/** The unit a dimension is measured in (count is the neutral default). */
export function unitOf(dimension: AnalyticsDimension): AnalyticsUnit {
  return DIMENSION_UNITS.get(dimension) ?? AnalyticsUnit.Count;
}

/** Whether higher is better for a dimension (neutral is the default). */
export function directionOf(dimension: AnalyticsDimension): AnalyticsDirection {
  return DIMENSION_DIRECTIONS.get(dimension) ?? AnalyticsDirection.Neutral;
}

/** Narrow an untyped jsonb source-coverage column to a numeric record. */
export function toCoverage(value: unknown): Readonly<Record<string, number>> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return {};
  }
  const numeric = Object.entries(value).filter(
    (entry): entry is [string, number] =>
      typeof entry[1] === 'number' && Number.isFinite(entry[1]),
  );
  return Object.fromEntries(numeric);
}
