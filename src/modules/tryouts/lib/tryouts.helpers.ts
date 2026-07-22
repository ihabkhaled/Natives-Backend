import { createHash } from 'node:crypto';

import {
  IDENTITY_HASH_ALGORITHM,
  LIST_DEFAULT_LIMIT,
  LIST_DEFAULT_OFFSET,
  LIST_MAX_LIMIT,
  RATING_MAX,
  RATING_MIN,
} from '../model/tryouts.constants';
import type { PageRequest } from '../model/tryouts.types';

/** Clamp caller-supplied paging to the module's bounded window. */
export function resolveTryoutsPage(
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
 * The duplicate-detection fingerprint of a registrant. It is a one-way digest of
 * the normalized name and contact reference scoped to the event, so the same
 * person registering twice collides — WITHOUT the application ever storing a
 * reversible copy of their details for matching.
 */
export function identityHash(
  eventId: string,
  displayName: string,
  contactReference: string | null,
): string {
  return createHash(IDENTITY_HASH_ALGORITHM)
    .update(
      `${eventId}|${normalizeIdentity(displayName)}|${normalizeIdentity(
        contactReference ?? '',
      )}`,
    )
    .digest('hex');
}

/** Case-, accent-, and whitespace-insensitive normalization for matching. */
export function normalizeIdentity(value: string): string {
  return value
    .normalize('NFKD')
    .replaceAll(/[̀-ͯ]/gu, '')
    .trim()
    .toLowerCase()
    .replaceAll(/\s+/gu, ' ');
}

/**
 * Keep only in-range numeric ratings from an untrusted payload. An out-of-range
 * or non-numeric entry is DROPPED rather than clamped, so a bad input never
 * silently becomes a score.
 */
export function sanitizeRatings(
  raw: Readonly<Record<string, unknown>>,
): Readonly<Record<string, number>> {
  const valid = Object.entries(raw).filter((entry): entry is [string, number] =>
    isValidRating(entry[1]),
  );
  return Object.fromEntries(valid);
}

export function isValidRating(value: unknown): value is number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return false;
  }
  return value >= RATING_MIN && value <= RATING_MAX;
}

/** Narrow an untyped jsonb ratings column to a plain record. */
export function asRatingRecord(
  value: unknown,
): Readonly<Record<string, unknown>> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return {};
  }
  return { ...value };
}
