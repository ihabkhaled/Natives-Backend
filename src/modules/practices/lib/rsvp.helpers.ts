import {
  RSVP_NOTE_VISIBILITY_VALUES,
  RSVP_REASON_CATEGORY_VALUES,
  RSVP_SOURCE_VALUES,
  RSVP_STATUS_VALUES,
  type RsvpNoteVisibility,
  type RsvpReasonCategory,
  type RsvpSource,
  type RsvpStatus,
} from '../model/rsvp.enums';
import type { RsvpListFilter, RsvpListQuery } from '../model/rsvp.types';
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

/** Map a persisted status string to the RsvpStatus enum (rejects unknowns). */
export function parseRsvpStatus(raw: string): RsvpStatus {
  return parseEnum(RSVP_STATUS_VALUES, raw, 'rsvp status');
}

/** Map a nullable persisted status string to RsvpStatus or null (null-preserving). */
export function parseNullableRsvpStatus(raw: string | null): RsvpStatus | null {
  return raw === null ? null : parseRsvpStatus(raw);
}

/** Map a nullable persisted reason string to RsvpReasonCategory or null. */
export function parseReasonCategory(
  raw: string | null,
): RsvpReasonCategory | null {
  return raw === null
    ? null
    : parseEnum(RSVP_REASON_CATEGORY_VALUES, raw, 'rsvp reason category');
}

/** Map a persisted note-visibility string to the RsvpNoteVisibility enum. */
export function parseNoteVisibility(raw: string): RsvpNoteVisibility {
  return parseEnum(RSVP_NOTE_VISIBILITY_VALUES, raw, 'rsvp note visibility');
}

/** Map a persisted source string to the RsvpSource enum. */
export function parseRsvpSource(raw: string): RsvpSource {
  return parseEnum(RSVP_SOURCE_VALUES, raw, 'rsvp source');
}

/**
 * Resolve a participant-list query into a bounded, allowlisted filter. Status is
 * the only filterable dimension; pagination is clamped to safe bounds.
 */
export function resolveRsvpFilter(query: RsvpListQuery): RsvpListFilter {
  const page = resolvePage(query.limit, query.offset);
  return {
    status: query.status ?? null,
    limit: page.limit,
    offset: page.offset,
  };
}
