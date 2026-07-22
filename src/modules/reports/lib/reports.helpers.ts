import { createHash } from 'node:crypto';

import {
  CHECKSUM_ALGORITHM,
  LIST_DEFAULT_LIMIT,
  LIST_DEFAULT_OFFSET,
  LIST_MAX_LIMIT,
  PARAMETER_VALUE_MAX_LENGTH,
  PARAMETERS_MAX_KEYS,
  TEMPLATE_DEFAULT_FORMAT,
  TEMPLATE_PRIVACY,
} from '../model/reports.constants';
import type { ReportTemplate } from '../model/reports.enums';
import { ReportFormat, ReportPrivacyClass } from '../model/reports.enums';
import type { PageRequest, ReportRequest } from '../model/reports.types';

export function resolveReportsPage(
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

/** The privacy class a template defaults to (restricted is the safe default). */
export function privacyOf(template: ReportTemplate): ReportPrivacyClass {
  return TEMPLATE_PRIVACY.get(template) ?? ReportPrivacyClass.Restricted;
}

/** The default output format a template renders in. */
export function defaultFormatOf(template: ReportTemplate): ReportFormat {
  return TEMPLATE_DEFAULT_FORMAT.get(template) ?? ReportFormat.Csv;
}

/**
 * A stable request fingerprint: the same team, template, format, season, and
 * parameters hash identically, so a re-request replays to the same job rather
 * than regenerating — that is the idempotency the queue relies on.
 */
export function requestHash(teamId: string, request: ReportRequest): string {
  const canonical = JSON.stringify({
    teamId,
    seasonId: request.seasonId,
    template: request.template,
    format: request.format,
    parameters: sortedParameters(request.parameters),
  });
  return createHash(CHECKSUM_ALGORITHM).update(canonical).digest('hex');
}

/** Bound and normalize the parameter map from an untrusted request. */
export function normalizeParameters(
  raw: Readonly<Record<string, string>>,
): Readonly<Record<string, string>> {
  const entries = Object.entries(raw).slice(0, PARAMETERS_MAX_KEYS);
  return Object.fromEntries(
    entries.map(([key, value]) => [
      key,
      value.slice(0, PARAMETER_VALUE_MAX_LENGTH),
    ]),
  );
}

/** Narrow an untyped jsonb parameters column to a string record. */
export function toParameters(value: unknown): Readonly<Record<string, string>> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [key, String(entry)]),
  );
}

function sortedParameters(
  parameters: Readonly<Record<string, string>>,
): readonly [string, string][] {
  return Object.entries(parameters).sort((left, right) =>
    left[0].localeCompare(right[0]),
  );
}
