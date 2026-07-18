/**
 * Enumerations for the members bounded context. Every enum ships a `*_VALUES`
 * array so DTO validation and pure guards reference the canonical set without
 * re-listing literals. Values are the stable strings persisted in the database.
 */

/**
 * Membership lifecycle. A membership is the person-in-a-team record; its status
 * is an explicit state (never an ambiguous boolean). Historical facts stay linked
 * in every non-active state. Anonymized is a privileged retention end-state.
 */
export enum MembershipStatus {
  Invited = 'invited',
  Active = 'active',
  Inactive = 'inactive',
  Suspended = 'suspended',
  Left = 'left',
  Archived = 'archived',
  Anonymized = 'anonymized',
}

export const MEMBERSHIP_STATUS_VALUES: readonly MembershipStatus[] =
  Object.values(MembershipStatus);

/** Personal gender field on a player profile (self-declared, restricted). */
export enum PlayerGender {
  Man = 'man',
  Woman = 'woman',
  Nonbinary = 'nonbinary',
  Undisclosed = 'undisclosed',
}

export const PLAYER_GENDER_VALUES: readonly PlayerGender[] =
  Object.values(PlayerGender);

/**
 * Malware/content-scan state for an uploaded media asset. An avatar is only ever
 * served or attached once it is `clean`; missing/pending/failed never breaks
 * profile rendering (the avatar is simply absent).
 */
export enum MediaScanStatus {
  Pending = 'pending',
  Clean = 'clean',
  Infected = 'infected',
  Failed = 'failed',
}

export const MEDIA_SCAN_STATUS_VALUES: readonly MediaScanStatus[] =
  Object.values(MediaScanStatus);

/** What a media asset is used for. Only avatars are modelled in this slice. */
export enum MediaPurpose {
  Avatar = 'avatar',
}

export const MEDIA_PURPOSE_VALUES: readonly MediaPurpose[] =
  Object.values(MediaPurpose);

/** Where a member alias came from — a manual entry or a migration import. */
export enum AliasSource {
  Manual = 'manual',
  Import = 'import',
}

export const ALIAS_SOURCE_VALUES: readonly AliasSource[] =
  Object.values(AliasSource);

/**
 * The privilege tier a viewer has against a specific member, resolved from their
 * effective permissions and team relationship. `Self` is tracked separately (a
 * viewer can be self AND one of these tiers); the returned view label combines
 * both. Ordered least-to-most privileged.
 */
export enum MemberViewTier {
  Public = 'public',
  Teammate = 'teammate',
  Coach = 'coach',
  Admin = 'admin',
}

/** The distinct shaped view a response was rendered for. */
export enum MemberAudience {
  Public = 'public',
  Teammate = 'teammate',
  Self = 'self',
  Coach = 'coach',
  Admin = 'admin',
}

/** Age divisions derived from date of birth (null when DOB is unknown). */
export enum AgeClassification {
  Under17 = 'u17',
  Under20 = 'u20',
  Senior = 'senior',
  Masters = 'masters',
  GrandMasters = 'grand_masters',
}
