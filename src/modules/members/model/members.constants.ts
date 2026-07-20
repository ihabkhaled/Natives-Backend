import type { ErrorMessageKey } from '@core/errors/error.types';

import { MediaPurpose } from './members.enums';

// --- Ports -------------------------------------------------------------------
// Object-storage boundary for signed media access. The only vendor seam for
// media; use cases depend on this symbol, never on a storage SDK.
export const MEDIA_STORAGE_PORT = Symbol('MEDIA_STORAGE_PORT');

// --- Routes & OpenAPI tag ----------------------------------------------------
// Members are always addressed within their team so the guard resolves the
// team scope from the `:teamId` path param (never a client-supplied body).
export const MEMBERS_ROUTE = 'teams/:teamId/members';
export const MEMBERS_API_TAG = 'members';

export const MEMBER_INVITE_ROUTE = 'invite';
export const MEMBER_BY_ID_ROUTE = ':membershipId';
export const MEMBER_PROFILE_ROUTE = ':membershipId/profile';
export const MEMBER_ACTIVATE_ROUTE = ':membershipId/activate';
export const MEMBER_DEACTIVATE_ROUTE = ':membershipId/deactivate';
export const MEMBER_SUSPEND_ROUTE = ':membershipId/suspend';
export const MEMBER_LEAVE_ROUTE = ':membershipId/leave';
export const MEMBER_ARCHIVE_ROUTE = ':membershipId/archive';
export const MEMBER_ANONYMIZE_ROUTE = ':membershipId/anonymize';
export const MEMBER_HISTORY_ROUTE = ':membershipId/history';
export const MEMBER_ALIASES_ROUTE = ':membershipId/aliases';
export const MEMBER_ALIAS_BY_ID_ROUTE = ':membershipId/aliases/:aliasId';
export const MEMBER_AVATAR_ROUTE = ':membershipId/avatar';
export const MEMBER_AVATAR_ATTACH_ROUTE = ':membershipId/avatar/:mediaId';
export const MEMBER_MEDIA_SCAN_ROUTE = ':membershipId/media/:mediaId/scan';
export const MEMBER_ROLES_ROUTE = ':membershipId/roles';
export const MEMBER_ROLES_API_TAG = 'member-roles';

// Upper bound on the role slugs a single assignment request may carry. The
// seeded catalog has five bundles; the cap keeps the request payload bounded.
export const MEMBER_ROLES_MAX_COUNT = 16;
export const MEMBER_ROLE_SLUG_MAX_LENGTH = 64;

// --- Route param names -------------------------------------------------------
export const TEAM_ID_PARAM = 'teamId';
export const MEMBERSHIP_ID_PARAM = 'membershipId';
export const ALIAS_ID_PARAM = 'aliasId';
export const MEDIA_ID_PARAM = 'mediaId';

// --- Field bounds ------------------------------------------------------------
export const NAME_MIN_LENGTH = 1;
export const NAME_MAX_LENGTH = 120;
export const NICKNAME_MAX_LENGTH = 60;
export const EMAIL_MAX_LENGTH = 320;
export const PHONE_MAX_LENGTH = 40;
export const REASON_MAX_LENGTH = 512;
export const ALIAS_MIN_LENGTH = 1;
export const ALIAS_MAX_LENGTH = 160;
export const JERSEY_SIZE_MAX_LENGTH = 16;
export const DIVISION_KEY_MAX_LENGTH = 64;
export const POSITION_KEY_MAX_LENGTH = 64;
export const POSITIONS_MAX_COUNT = 8;
export const JERSEY_NUMBER_MIN = 0;
export const JERSEY_NUMBER_MAX = 999;
export const HEIGHT_CM_MIN = 50;
export const HEIGHT_CM_MAX = 260;
export const WEIGHT_KG_MIN = 20;
export const WEIGHT_KG_MAX = 300;
export const STORAGE_KEY_MAX_LENGTH = 256;
export const CONTENT_TYPE_MAX_LENGTH = 128;

// --- Media validation --------------------------------------------------------
// Avatars only: small raster images, isolated object-storage keys, never DB blobs.
export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
export const AVATAR_MIN_DIMENSION = 32;
export const AVATAR_MAX_DIMENSION = 4096;
export const AVATAR_ALLOWED_CONTENT_TYPES: readonly string[] = [
  'image/jpeg',
  'image/png',
  'image/webp',
];
export const MEDIA_UPLOAD_URL_TTL_SECONDS = 300;
export const MEDIA_DOWNLOAD_URL_TTL_SECONDS = 300;
export const DEFAULT_MEDIA_PURPOSE = MediaPurpose.Avatar;

// Signed-URL object-storage stand-in. The base host is a private bucket origin;
// URLs are HMAC-signed and short-lived. Swapping to a real provider (S3/GCS)
// touches only the adapter, never the application layer.
export const MEDIA_STORAGE_BASE_URL = 'https://media.natives.local';
export const MEDIA_KEY_PREFIX = 'members';
export const MEDIA_SIGNATURE_ALGORITHM = 'sha256' as const;
export const MEDIA_UPLOAD_METHOD = 'PUT' as const;
export const MEDIA_DOWNLOAD_METHOD = 'GET' as const;
export const MILLISECONDS_PER_SECOND = 1000;

// --- Age classification thresholds (whole years, inclusive lower bound) -------
export const AGE_U17_MAX_EXCLUSIVE = 17;
export const AGE_U20_MAX_EXCLUSIVE = 20;
export const AGE_MASTERS_MIN = 33;
export const AGE_GRAND_MASTERS_MIN = 40;

// --- Pagination --------------------------------------------------------------
export const LIST_DEFAULT_LIMIT = 20;
export const LIST_MIN_LIMIT = 1;
export const LIST_MAX_LIMIT = 100;
export const LIST_DEFAULT_OFFSET = 0;

// Upper bound on active jersey rows scanned when resolving a jersey collision.
// Roster cardinality per team/season is small; this keeps the scan bounded.
export const JERSEY_SCAN_LIMIT = 1000;
// The optional profile fields the completeness projection scores. Mandatory
// fields are excluded so the percentage measures what a member can still do.
export const PROFILE_COMPLETENESS_FIELD_COUNT = 8;

// Membership lifecycle state that still needs an activation decision.
export const MEMBERSHIP_INVITED_STATE = 'invited';

// Upper bound on the memberships resolved for one principal. A person belongs
// to a handful of team/season scopes, so this keeps the principal read bounded.
export const MEMBERSHIP_CONTEXT_MAX = 50;
export const ALIAS_LIST_MAX = 200;
export const HISTORY_LIST_MAX = 200;

// --- Date-only pattern (ISO YYYY-MM-DD) --------------------------------------
export const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;

// --- Static persistence column lists -----------------------------------------
// Kept here (not inline in the repositories) so implementation-layer files hold
// only their class. Every list is a fixed allow-list of columns — never dynamic.
export const MEMBERSHIP_COLUMNS = `"id", "team_id", "season_id", "user_id",
  "status", "status_reason", "status_effective_at", "joined_at", "left_at",
  "anonymized_at", "created_by", "updated_by", "created_at", "updated_at",
  "deleted_at", "version"`;

export const MEMBER_PROFILE_COLUMNS = `"id", "membership_id", "team_id",
  "full_name", "preferred_name", "full_name_ar", "nickname", "email", "phone",
  "gender", "division", "positions", "jersey_number", "jersey_size", "height_cm",
  "weight_kg", to_char("date_of_birth", 'YYYY-MM-DD') AS "date_of_birth",
  "avatar_media_id", "created_by", "updated_by", "created_at", "updated_at",
  "version"`;

export const STATUS_EVENT_COLUMNS = `"id", "membership_id", "from_status",
  "to_status", "reason", "actor_user_id", "effective_at", "occurred_at"`;

export const ALIAS_COLUMNS = `"id", "membership_id", "team_id", "alias",
  "normalized_alias", "source", "created_by", "created_at", "deleted_at"`;

export const MEDIA_ASSET_COLUMNS = `"id", "team_id", "membership_id", "purpose",
  "storage_key", "content_type", "byte_size", "width", "height", "scan_status",
  "created_by", "created_at", "deleted_at"`;

// --- Audit event types (append-only security_events) -------------------------
export const MEMBER_INVITED_EVENT = 'member.invited';
export const MEMBER_TRANSITIONED_EVENT = 'member.transitioned';
export const MEMBER_ANONYMIZED_EVENT = 'member.anonymized';
export const MEMBER_PROFILE_UPDATED_EVENT = 'member.profileUpdated';
export const MEMBER_ALIAS_ADDED_EVENT = 'member.aliasAdded';
export const MEMBER_ALIAS_REMOVED_EVENT = 'member.aliasRemoved';
export const MEMBER_AVATAR_REQUESTED_EVENT = 'member.avatarRequested';
export const MEMBER_AVATAR_ATTACHED_EVENT = 'member.avatarAttached';
export const MEMBER_MEDIA_SCANNED_EVENT = 'member.mediaScanned';

// --- Redaction placeholder for anonymized profiles ---------------------------
export const ANONYMIZED_NAME = 'Former member';

// --- Error messages & keys ---------------------------------------------------
export const MEMBERSHIP_NOT_FOUND_MESSAGE =
  'The member was not found in this team';
export const MEMBERSHIP_NOT_FOUND_MESSAGE_KEY: ErrorMessageKey =
  'errors.members.membershipNotFound';

export const TEAM_SCOPE_NOT_FOUND_MESSAGE =
  'The team was not found or is not active';
export const TEAM_SCOPE_NOT_FOUND_MESSAGE_KEY: ErrorMessageKey =
  'errors.members.teamNotFound';

export const MEMBERSHIP_CONFLICT_MESSAGE =
  'This person already has a membership in this team and season';
export const MEMBERSHIP_CONFLICT_MESSAGE_KEY: ErrorMessageKey =
  'errors.members.membershipConflict';

export const INVALID_TRANSITION_MESSAGE =
  'The requested membership state change is not allowed from the current state';
export const INVALID_TRANSITION_MESSAGE_KEY: ErrorMessageKey =
  'errors.members.invalidTransition';

export const PROFILE_FORBIDDEN_MESSAGE =
  'You may not modify this member profile';
export const PROFILE_FORBIDDEN_MESSAGE_KEY: ErrorMessageKey =
  'errors.members.profileForbidden';

export const VERSION_CONFLICT_MESSAGE =
  'The record was modified by someone else; reload and retry';
export const VERSION_CONFLICT_MESSAGE_KEY: ErrorMessageKey =
  'errors.members.versionConflict';

export const JERSEY_CONFLICT_MESSAGE =
  'That jersey number is already reserved by an active member in this scope';
export const JERSEY_CONFLICT_MESSAGE_KEY: ErrorMessageKey =
  'errors.members.jerseyConflict';

export const ALIAS_CONFLICT_MESSAGE =
  'That alias is already in use by an active member in this team';
export const ALIAS_CONFLICT_MESSAGE_KEY: ErrorMessageKey =
  'errors.members.aliasConflict';

export const ALIAS_NOT_FOUND_MESSAGE = 'The alias was not found';
export const ALIAS_NOT_FOUND_MESSAGE_KEY: ErrorMessageKey =
  'errors.members.aliasNotFound';

export const MEDIA_NOT_FOUND_MESSAGE = 'The media asset was not found';
export const MEDIA_NOT_FOUND_MESSAGE_KEY: ErrorMessageKey =
  'errors.members.mediaNotFound';

export const MEDIA_VALIDATION_MESSAGE =
  'The media does not meet the avatar type, size, or dimension requirements';
export const MEDIA_VALIDATION_MESSAGE_KEY: ErrorMessageKey =
  'errors.members.mediaValidation';

export const MEDIA_NOT_SCANNED_MESSAGE =
  'The media is not yet cleared by the malware scan';
export const MEDIA_NOT_SCANNED_MESSAGE_KEY: ErrorMessageKey =
  'errors.members.mediaNotScanned';

export const PROFILE_INVALID_DATE_MESSAGE =
  'The date of birth is not a valid calendar date';
export const PROFILE_INVALID_DATE_MESSAGE_KEY: ErrorMessageKey =
  'errors.members.invalidDate';

export const MEMBER_ACCOUNT_REQUIRED_MESSAGE =
  'This member has no linked account yet, so roles cannot be assigned';
export const MEMBER_ACCOUNT_REQUIRED_MESSAGE_KEY: ErrorMessageKey =
  'errors.members.accountRequired';

export const ALIAS_INVALID_MESSAGE =
  'The alias is empty after normalization and cannot be used for matching';
export const ALIAS_INVALID_MESSAGE_KEY: ErrorMessageKey =
  'errors.members.aliasInvalid';
