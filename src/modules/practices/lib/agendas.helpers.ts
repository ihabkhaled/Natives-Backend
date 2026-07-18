import type {
  AgendaBlockType,
  AgendaStatus,
  CompletionStatus,
  DrillCategory,
  DrillIntensity,
  DrillStatus,
} from '../model/agendas.enums';
import {
  AGENDA_BLOCK_TYPE_VALUES,
  AGENDA_STATUS_VALUES,
  COMPLETION_STATUS_VALUES,
  DRILL_CATEGORY_VALUES,
  DRILL_INTENSITY_VALUES,
  DRILL_STATUS_VALUES,
} from '../model/agendas.enums';
import type {
  ListDrillsQuery,
  ListDrillsQueryInput,
} from '../model/agendas.types';
import { resolvePage } from './practices.helpers';

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

export function parseDrillCategory(raw: string): DrillCategory {
  return parseEnum(DRILL_CATEGORY_VALUES, raw, 'drill category');
}

export function parseDrillIntensity(raw: string): DrillIntensity {
  return parseEnum(DRILL_INTENSITY_VALUES, raw, 'drill intensity');
}

export function parseNullableIntensity(
  raw: string | null,
): DrillIntensity | null {
  return raw === null ? null : parseDrillIntensity(raw);
}

export function parseDrillStatus(raw: string): DrillStatus {
  return parseEnum(DRILL_STATUS_VALUES, raw, 'drill status');
}

export function parseAgendaStatus(raw: string): AgendaStatus {
  return parseEnum(AGENDA_STATUS_VALUES, raw, 'agenda status');
}

export function parseBlockType(raw: string): AgendaBlockType {
  return parseEnum(AGENDA_BLOCK_TYPE_VALUES, raw, 'agenda block type');
}

export function parseCompletionStatus(raw: string): CompletionStatus {
  return parseEnum(COMPLETION_STATUS_VALUES, raw, 'completion status');
}

/** Coalesce a nullable text[] column to a defined, immutable string array. */
export function coalesceStrings(
  value: readonly string[] | null,
): readonly string[] {
  return value ?? [];
}

/**
 * Resolve a caller-supplied list-drills query into a bounded, allowlisted filter.
 * Absent dimensions become null (unfiltered); pagination is clamped. Only these
 * fixed dimensions are ever filterable.
 */
export function resolveDrillsQuery(
  query: ListDrillsQueryInput,
): ListDrillsQuery {
  const page = resolvePage(query.limit, query.offset);
  return {
    category: query.category ?? null,
    status: query.status ?? null,
    skillTag: query.skillTag ?? null,
    limit: page.limit,
    offset: page.offset,
  };
}
