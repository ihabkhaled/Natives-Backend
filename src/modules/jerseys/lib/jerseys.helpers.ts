import {
  LIST_DEFAULT_LIMIT,
  LIST_DEFAULT_OFFSET,
  LIST_MAX_LIMIT,
  PRINTED_NAME_MAX_LENGTH,
} from '../model/jerseys.constants';
import type { PageRequest } from '../model/jerseys.types';

export function resolveJerseysPage(
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
 * Normalize a printed name for uniqueness and print. Upper-cased, trimmed,
 * inner whitespace collapsed, length-bounded — so `Ali`, `ali `, and `ALI` are
 * one printed name, and a shirt back never carries a runaway string.
 */
export function normalizePrintedName(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replaceAll(/\s+/gu, ' ')
    .slice(0, PRINTED_NAME_MAX_LENGTH);
}
