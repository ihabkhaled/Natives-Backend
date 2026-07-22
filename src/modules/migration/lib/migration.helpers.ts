import { createHash } from 'node:crypto';

import {
  LIST_DEFAULT_LIMIT,
  LIST_DEFAULT_OFFSET,
  LIST_MAX_LIMIT,
  SOURCE_HASH_ALGORITHM,
} from '../model/migration.constants';
import type { ImportSourceRow, PageRequest } from '../model/migration.types';

export function resolveMigrationPage(
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
 * A stable content hash of the source rows. The hash — not the file — is stored,
 * so a re-upload of the same workbook is detected as a duplicate WITHOUT ever
 * persisting the private source values.
 */
export function sourceHash(rows: readonly ImportSourceRow[]): string {
  const canonical = JSON.stringify(
    [...rows]
      .map(row => ({ rowRef: row.rowRef, cells: sortedCells(row.cells) }))
      .sort((left, right) => left.rowRef.localeCompare(right.rowRef)),
  );
  return createHash(SOURCE_HASH_ALGORITHM).update(canonical).digest('hex');
}

function sortedCells(
  cells: Readonly<Record<string, string>>,
): readonly [string, string][] {
  return Object.entries(cells).sort((left, right) =>
    left[0].localeCompare(right[0]),
  );
}
