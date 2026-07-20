import {
  ENTRY_DEFAULT_LIMIT,
  ENTRY_MAX_LIMIT,
  LIST_DEFAULT_LIMIT,
  LIST_DEFAULT_OFFSET,
  LIST_MAX_LIMIT,
} from '../model/rosters.constants';
import type { PageRequest } from '../model/rosters.types';

/** Clamp caller-supplied paging to the module's bounded, deterministic window. */
export function resolveRostersPage(
  limit: number | undefined,
  offset: number | undefined,
): PageRequest {
  return {
    limit: Math.min(limit ?? LIST_DEFAULT_LIMIT, LIST_MAX_LIMIT),
    offset: offset ?? LIST_DEFAULT_OFFSET,
  };
}

/** Clamp paging for entry and snapshot reads, which allow a larger page. */
export function resolveEntriesPage(
  limit: number | undefined,
  offset: number | undefined,
): PageRequest {
  return {
    limit: Math.min(limit ?? ENTRY_DEFAULT_LIMIT, ENTRY_MAX_LIMIT),
    offset: offset ?? LIST_DEFAULT_OFFSET,
  };
}

export function toDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

export function toNullableDate(value: string | Date | null): Date | null {
  return value === null ? null : toDate(value);
}

/** Coerce a numeric/text column (an integer may arrive as a string) to a number. */
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

export function parseNullableEnumValue<TValue extends string>(
  values: readonly TValue[],
  raw: string | null,
  label: string,
): TValue | null {
  return raw === null ? null : parseEnumValue(values, raw, label);
}

/** Read a required string field from a frozen snapshot element. */
export function readString(
  fields: ReadonlyMap<string, unknown>,
  key: string,
  label: string,
): string {
  const value = fields.get(key);
  if (typeof value !== 'string') {
    throw new Error(`Unrecognized ${label}: ${String(value)}`);
  }
  return value;
}

/** Read a nullable numeric field from a frozen snapshot element. */
export function readNullableNumber(
  fields: ReadonlyMap<string, unknown>,
  key: string,
): number | null {
  const value = fields.get(key);
  return typeof value === 'number' ? value : null;
}

/** Read a nullable string field from a frozen snapshot element. */
export function readNullableString(
  fields: ReadonlyMap<string, unknown>,
  key: string,
): string | null {
  const value = fields.get(key);
  return typeof value === 'string' ? value : null;
}

/** Read a boolean field from a frozen snapshot element (absent = false). */
export function readBoolean(
  fields: ReadonlyMap<string, unknown>,
  key: string,
): boolean {
  return fields.get(key) === true;
}

/**
 * Narrow an untyped jsonb element to a keyed field lookup, rejecting anything
 * that is not a plain object. Reading through a Map keeps a stored key from ever
 * reaching a property sink.
 */
export function asFields(value: unknown): ReadonlyMap<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Unrecognized roster snapshot entry');
  }
  return new Map(Object.entries(value));
}

/** Narrow an untyped jsonb value to an array, rejecting anything else. */
export function asArray(value: unknown): readonly unknown[] {
  if (!Array.isArray(value)) {
    throw new Error('Unrecognized roster snapshot payload');
  }
  return value;
}
