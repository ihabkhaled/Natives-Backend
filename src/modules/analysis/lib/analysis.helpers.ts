import {
  LIST_DEFAULT_LIMIT,
  LIST_DEFAULT_OFFSET,
  LIST_MAX_LIMIT,
  TAG_MAX_LENGTH,
} from '../model/analysis.constants';
import type { PageRequest } from '../model/analysis.types';

/** Clamp caller-supplied paging to the module's bounded, deterministic window. */
export function resolveAnalysisPage(
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

/** Coerce a numeric/text column (an integer may arrive as a string). */
export function toNumber(value: string | number): number {
  return typeof value === 'number' ? value : Number(value);
}

/** Coerce a nullable numeric column, preserving null as "not recorded". */
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

/**
 * Normalize a free tag: trimmed, lower-cased, inner whitespace collapsed and
 * length-bounded, so `Deep Cut`, `deep  cut` and `DEEP CUT ` are one tag rather
 * than three near-duplicates in the taxonomy.
 */
export function normalizeTag(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replaceAll(/\s+/gu, ' ')
    .slice(0, TAG_MAX_LENGTH);
}

/** Normalize, drop empties, and de-duplicate a caller-supplied tag list. */
export function normalizeTags(raw: readonly string[]): readonly string[] {
  const normalized = raw
    .map(tag => normalizeTag(tag))
    .filter(tag => tag.length > 0);
  return [...new Set(normalized)].sort((left, right) =>
    left.localeCompare(right),
  );
}

/** De-duplicate ids while preserving a deterministic order. */
export function uniqueIds(ids: readonly string[]): readonly string[] {
  return [...new Set(ids)].sort((left, right) => left.localeCompare(right));
}
