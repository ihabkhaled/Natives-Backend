import {
  DATE_PATTERN,
  LIST_DEFAULT_LIMIT,
  LIST_DEFAULT_OFFSET,
  LIST_MAX_LIMIT,
} from '../model/members.constants';
import type {
  AliasSource,
  MediaPurpose,
  MediaScanStatus,
  MembershipStatus,
  PlayerGender,
} from '../model/members.enums';
import {
  ALIAS_SOURCE_VALUES,
  MEDIA_PURPOSE_VALUES,
  MEDIA_SCAN_STATUS_VALUES,
  MEMBERSHIP_STATUS_VALUES,
  PLAYER_GENDER_VALUES,
} from '../model/members.enums';
import type {
  AliasRow,
  MediaAssetRow,
  MemberProfileRow,
  MembershipRow,
  StatusEventRow,
} from '../model/members.rows';
import type {
  MediaAsset,
  MemberAlias,
  MemberProfile,
  Membership,
  MembershipStatusEvent,
  PageRequest,
} from '../model/members.types';

// --- Scalar conversions ------------------------------------------------------

export function toDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

export function toNullableDate(value: string | Date | null): Date | null {
  if (value === null) {
    return null;
  }
  return value instanceof Date ? value : new Date(value);
}

/**
 * Convert a nullable Postgres numeric (driver returns a string) to a number,
 * preserving null. Null-not-zero: a missing measurement stays null, never 0.
 */
export function toNullableNumber(value: string | null): number | null {
  return value === null ? null : Number(value);
}

/**
 * True when `value` is a real calendar date in strict `YYYY-MM-DD` form. Rejects
 * malformed and impossible dates (e.g. 2005-02-30) so they surface as a clean 400
 * rather than a database error.
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

// --- Enum parsing ------------------------------------------------------------

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

export function parseMembershipStatus(raw: string): MembershipStatus {
  return parseEnum(MEMBERSHIP_STATUS_VALUES, raw, 'membership status');
}

export function parseNullableGender(raw: string | null): PlayerGender | null {
  return raw === null ? null : parseEnum(PLAYER_GENDER_VALUES, raw, 'gender');
}

export function parseMediaScanStatus(raw: string): MediaScanStatus {
  return parseEnum(MEDIA_SCAN_STATUS_VALUES, raw, 'media scan status');
}

export function parseMediaPurpose(raw: string): MediaPurpose {
  return parseEnum(MEDIA_PURPOSE_VALUES, raw, 'media purpose');
}

export function parseAliasSource(raw: string): AliasSource {
  return parseEnum(ALIAS_SOURCE_VALUES, raw, 'alias source');
}

// --- Row → domain mappers ----------------------------------------------------

export function toMembership(row: MembershipRow): Membership {
  return {
    id: row.id,
    teamId: row.team_id,
    seasonId: row.season_id,
    userId: row.user_id,
    status: parseMembershipStatus(row.status),
    statusReason: row.status_reason,
    statusEffectiveAt: toDate(row.status_effective_at),
    joinedAt: toNullableDate(row.joined_at),
    leftAt: toNullableDate(row.left_at),
    anonymizedAt: toNullableDate(row.anonymized_at),
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
    deletedAt: toNullableDate(row.deleted_at),
    version: row.version,
  };
}

export function toMemberProfile(row: MemberProfileRow): MemberProfile {
  return {
    id: row.id,
    membershipId: row.membership_id,
    teamId: row.team_id,
    fullName: row.full_name,
    preferredName: row.preferred_name,
    fullNameAr: row.full_name_ar,
    nickname: row.nickname,
    email: row.email,
    phone: row.phone,
    gender: parseNullableGender(row.gender),
    division: row.division,
    positions: row.positions,
    jerseyNumber: row.jersey_number,
    jerseySize: row.jersey_size,
    heightCm: toNullableNumber(row.height_cm),
    weightKg: toNullableNumber(row.weight_kg),
    dateOfBirth: row.date_of_birth,
    avatarMediaId: row.avatar_media_id,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
    version: row.version,
  };
}

export function toStatusEvent(row: StatusEventRow): MembershipStatusEvent {
  return {
    id: row.id,
    membershipId: row.membership_id,
    fromStatus:
      row.from_status === null ? null : parseMembershipStatus(row.from_status),
    toStatus: parseMembershipStatus(row.to_status),
    reason: row.reason,
    actorUserId: row.actor_user_id,
    effectiveAt: toDate(row.effective_at),
    occurredAt: toDate(row.occurred_at),
  };
}

export function toAlias(row: AliasRow): MemberAlias {
  return {
    id: row.id,
    membershipId: row.membership_id,
    teamId: row.team_id,
    alias: row.alias,
    normalizedAlias: row.normalized_alias,
    source: parseAliasSource(row.source),
    createdBy: row.created_by,
    createdAt: toDate(row.created_at),
    deletedAt: toNullableDate(row.deleted_at),
  };
}

export function toMediaAsset(row: MediaAssetRow): MediaAsset {
  return {
    id: row.id,
    teamId: row.team_id,
    membershipId: row.membership_id,
    purpose: parseMediaPurpose(row.purpose),
    storageKey: row.storage_key,
    contentType: row.content_type,
    byteSize: Number(row.byte_size),
    width: row.width,
    height: row.height,
    scanStatus: parseMediaScanStatus(row.scan_status),
    createdBy: row.created_by,
    createdAt: toDate(row.created_at),
    deletedAt: toNullableDate(row.deleted_at),
  };
}
