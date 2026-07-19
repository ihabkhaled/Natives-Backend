import {
  ADJUSTMENT_KEY_PREFIX,
  AWARD_KEY_PREFIX,
  ISO_DATE_LENGTH,
  KEY_SEGMENT_SEPARATOR,
  LIST_DEFAULT_LIMIT,
  LIST_DEFAULT_OFFSET,
  LIST_MAX_LIMIT,
  REVERSAL_KEY_PREFIX,
} from '../model/points.constants';
import type { PageRequest } from '../model/points.types';

/** Clamp caller-supplied paging to the module's bounded, deterministic window. */
export function resolvePointsPage(
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

export function toNumber(value: string | number): number {
  return typeof value === 'number' ? value : Number(value);
}

export function toNullableNumber(value: string | null): number | null {
  return value === null ? null : Number(value);
}

/** Sum-of-entries totals coalesce a null (no rows) to a measured zero. */
export function toTotal(value: string | null): number {
  return value === null ? 0 : Number(value);
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

/** Format an instant as the ISO date-only (YYYY-MM-DD) an entry is effective on. */
export function toIsoDate(now: Date): string {
  return now.toISOString().slice(0, ISO_DATE_LENGTH);
}

/** One award per submission per rule version. */
export function buildAwardKey(submissionId: string, ruleId: string): string {
  return join(AWARD_KEY_PREFIX, submissionId, ruleId);
}

/** One compensating reversal per awarded entry. */
export function buildReversalKey(awardEntryId: string): string {
  return join(REVERSAL_KEY_PREFIX, awardEntryId);
}

/** One adjustment per member per client operation key. */
export function buildAdjustmentKey(
  membershipId: string,
  operationKey: string,
): string {
  return join(ADJUSTMENT_KEY_PREFIX, membershipId, operationKey);
}

/** Positional 1-based rank within a bounded, deterministically ordered page. */
export function computeRank(offset: number, index: number): number {
  return offset + index + 1;
}

function join(...segments: readonly string[]): string {
  return segments.join(KEY_SEGMENT_SEPARATOR);
}
