import {
  DATE_PATTERN,
  LIST_DEFAULT_LIMIT,
  LIST_DEFAULT_OFFSET,
  LIST_MAX_LIMIT,
} from '../model/teams.constants';
import type {
  CatalogName,
  ResourceStatus,
  SeasonStatus,
  SettingKey,
  TeamStatus,
} from '../model/teams.enums';
import {
  CATALOG_NAME_VALUES,
  RESOURCE_STATUS_VALUES,
  SEASON_STATUS_VALUES,
  SETTING_KEY_VALUES,
  TEAM_STATUS_VALUES,
} from '../model/teams.enums';
import type { PageRequest, TransitionCommand } from '../model/teams.types';

/** Convert a non-null timestamptz value to a Date. */
export function toDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

/** Convert a nullable timestamptz value to a Date or null. */
export function toNullableDate(value: string | Date | null): Date | null {
  if (value === null) {
    return null;
  }
  return value instanceof Date ? value : new Date(value);
}

/**
 * Convert a nullable Postgres numeric (returned by the driver as a string) to a
 * number, preserving null. Null-not-zero: an absent coordinate stays null and is
 * never coerced to 0.
 */
export function toNullableNumber(value: string | null): number | null {
  return value === null ? null : Number(value);
}

/**
 * True when `value` is a real calendar date in strict `YYYY-MM-DD` form. Rejects
 * malformed strings and impossible dates (e.g. 2026-02-31), which would otherwise
 * be truncated or rejected by the database rather than reported as a clean 400.
 */
export function isIsoCalendarDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) {
    return false;
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    return false;
  }
  return value === parsed.toISOString().slice(0, 10);
}

/** Clamp a caller-supplied page window to safe, bounded values. */
export function resolvePage(
  limit: number | undefined,
  offset: number | undefined,
): PageRequest {
  const boundedLimit = Math.min(limit ?? LIST_DEFAULT_LIMIT, LIST_MAX_LIMIT);
  return {
    limit: Math.max(boundedLimit, 1),
    offset: Math.max(offset ?? LIST_DEFAULT_OFFSET, 0),
  };
}

/**
 * Normalise the optional `expectedVersion` of a transition body into the
 * command's explicit `number | null`. Absent means "no optimistic check", never
 * zero — a lifecycle move without a supplied version is still state-machine
 * gated, it just does not assert which version it moved from.
 */
export function toTransitionCommand(
  expectedVersion: number | undefined,
): TransitionCommand {
  return { expectedVersion: expectedVersion ?? null };
}

function parseEnum<TValue extends string>(
  values: readonly TValue[],
  raw: string,
  label: string,
): TValue {
  const match = values.find(value => value === raw);
  if (match === undefined) {
    throw new Error(`Unrecognized ${label} value: ${raw}`);
  }
  return match;
}

export function parseResourceStatus(raw: string): ResourceStatus {
  return parseEnum(RESOURCE_STATUS_VALUES, raw, 'resource status');
}

export function parseTeamStatus(raw: string): TeamStatus {
  return parseEnum(TEAM_STATUS_VALUES, raw, 'team status');
}

export function parseSeasonStatus(raw: string): SeasonStatus {
  return parseEnum(SEASON_STATUS_VALUES, raw, 'season status');
}

export function parseCatalogName(raw: string): CatalogName {
  return parseEnum(CATALOG_NAME_VALUES, raw, 'catalog name');
}

export function parseSettingKey(raw: string): SettingKey {
  return parseEnum(SETTING_KEY_VALUES, raw, 'setting key');
}
