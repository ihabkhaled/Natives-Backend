import {
  ELIGIBILITY_DEFAULT_LIMIT,
  ELIGIBILITY_MAX_LIMIT,
  LIST_DEFAULT_LIMIT,
  LIST_DEFAULT_OFFSET,
  LIST_MAX_LIMIT,
} from '../model/squads.constants';
import { SignalStatus } from '../model/squads.enums';
import type { EligibilitySignal, PageRequest } from '../model/squads.types';

/** Clamp caller-supplied paging to the module's bounded, deterministic window. */
export function resolveSquadsPage(
  limit: number | undefined,
  offset: number | undefined,
): PageRequest {
  return {
    limit: Math.min(limit ?? LIST_DEFAULT_LIMIT, LIST_MAX_LIMIT),
    offset: offset ?? LIST_DEFAULT_OFFSET,
  };
}

/** Clamp paging for the harder-bounded eligibility candidate pool. */
export function resolveEligibilityPage(
  limit: number | undefined,
  offset: number | undefined,
): PageRequest {
  return {
    limit: Math.min(limit ?? ELIGIBILITY_DEFAULT_LIMIT, ELIGIBILITY_MAX_LIMIT),
    offset: offset ?? LIST_DEFAULT_OFFSET,
  };
}

export function toDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

export function toNullableDate(value: string | Date | null): Date | null {
  return value === null ? null : toDate(value);
}

/** Coerce a numeric/text column (numeric(5,2) arrives as a string) to a number. */
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

export function parseNullableEnumValue<TValue extends string>(
  values: readonly TValue[],
  raw: string | null,
  label: string,
): TValue | null {
  return raw === null ? null : parseEnumValue(values, raw, label);
}

/**
 * A compact, privacy-safe snapshot of a selection's eligibility at the moment of
 * selection: the overall outcome plus the codes of any flagged signals — never a
 * medical detail or excuse note. Stored on the selection and its history event.
 */
export function summarizeEligibilitySnapshot(
  overall: SignalStatus,
  signals: readonly EligibilitySignal[],
): string {
  const flaggedCodes = signals
    .filter(item => isFlaggedSignal(item.status))
    .map(item => item.code);
  if (flaggedCodes.length === 0) {
    return overall;
  }
  return `${overall}:${flaggedCodes.join(',')}`;
}

function isFlaggedSignal(status: SignalStatus): boolean {
  return status === SignalStatus.Failed || status === SignalStatus.Warning;
}
