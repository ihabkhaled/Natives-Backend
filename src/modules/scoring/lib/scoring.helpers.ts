import { createHash } from 'node:crypto';

import {
  LIST_DEFAULT_LIMIT,
  LIST_DEFAULT_OFFSET,
  LIST_MAX_LIMIT,
} from '../model/scoring.constants';
import type { CategoryInput, PageRequest } from '../model/scoring.types';

/** Clamp caller-supplied paging to the module's bounded, deterministic window. */
export function resolveScoringPage(
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

export function toNumber(value: string | number): number {
  return typeof value === 'number' ? value : Number(value);
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
 * presentation boundary so the engine never claims false precision. Null stays
 * null (a missing value is never rounded to zero).
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

/**
 * Content fingerprint of the source facts that produced a projection: the rule
 * identity plus the sorted category inputs. A rebuild that sees the same source
 * and rule yields the same hash, so a correction/rebuild equals a clean recompute.
 */
export function buildSourceHash(
  ruleId: string,
  ruleVersion: number,
  inputs: readonly CategoryInput[],
): string {
  const parts = inputs
    .map(
      input =>
        `${input.categoryKey}:${serializeNullable(input.value)}:` +
        `${input.assessedMetrics}:${input.totalMetrics}`,
    )
    .sort((left, right) => (left < right ? -1 : 1));
  const canonical = `${ruleId}@${ruleVersion}|${parts.join('|')}`;
  return createHash('sha256').update(canonical).digest('hex');
}

function serializeNullable(value: number | null): string {
  return value === null ? 'null' : value.toString();
}
