import {
  LIST_DEFAULT_LIMIT,
  LIST_DEFAULT_OFFSET,
  LIST_MAX_LIMIT,
  RULE_SEVERITY,
} from '../model/dataquality.constants';
import type { DataQualityRule } from '../model/dataquality.enums';
import { AnomalySeverity } from '../model/dataquality.enums';
import type { PageRequest } from '../model/dataquality.types';

export function resolveDataQualityPage(
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

/** The severity a rule reports at (warning is the neutral default). */
export function severityOf(rule: DataQualityRule): AnomalySeverity {
  return RULE_SEVERITY.get(rule) ?? AnomalySeverity.Warning;
}
