import type {
  AgeClassification,
  AliasSource,
  MediaPurpose,
  MediaScanStatus,
  MemberAudience,
  MembershipStatus,
  MemberViewTier,
  PlayerGender,
} from './members.enums';

// --- Domain aggregates -------------------------------------------------------

/**
 * A membership: a person's participation in a team (optionally a season). The
 * account link (`userId`) is nullable so historical players and candidates need
 * no login. Soft-deletable, optimistic-versioned, actor-audited.
 */
export interface Membership {
  readonly id: string;
  readonly teamId: string;
  readonly seasonId: string | null;
  readonly userId: string | null;
  readonly status: MembershipStatus;
  readonly statusReason: string | null;
  readonly statusEffectiveAt: Date;
  readonly joinedAt: Date | null;
  readonly leftAt: Date | null;
  readonly anonymizedAt: Date | null;
  readonly createdBy: string | null;
  readonly updatedBy: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly deletedAt: Date | null;
  readonly version: number;
}

/** A player profile: the descriptive, privacy-classified fields for a membership. */
export interface MemberProfile {
  readonly id: string;
  readonly membershipId: string;
  readonly teamId: string;
  readonly fullName: string;
  readonly preferredName: string | null;
  readonly fullNameAr: string | null;
  readonly nickname: string | null;
  readonly email: string | null;
  readonly phone: string | null;
  readonly gender: PlayerGender | null;
  readonly division: string | null;
  readonly positions: readonly string[];
  readonly jerseyNumber: number | null;
  readonly jerseySize: string | null;
  readonly heightCm: number | null;
  readonly weightKg: number | null;
  readonly dateOfBirth: string | null;
  readonly avatarMediaId: string | null;
  readonly createdBy: string | null;
  readonly updatedBy: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly version: number;
}

/** One membership + its profile, loaded together for reads and shaping. */
export interface MemberRecord {
  readonly membership: Membership;
  readonly profile: MemberProfile;
}

/** An append-only lifecycle transition row (the status history timeline). */
export interface MembershipStatusEvent {
  readonly id: string;
  readonly membershipId: string;
  readonly fromStatus: MembershipStatus | null;
  readonly toStatus: MembershipStatus;
  readonly reason: string | null;
  readonly actorUserId: string | null;
  readonly effectiveAt: Date;
  readonly occurredAt: Date;
}

/** A normalized name alias for import matching, scoped and soft-deletable. */
export interface MemberAlias {
  readonly id: string;
  readonly membershipId: string;
  readonly teamId: string;
  readonly alias: string;
  readonly normalizedAlias: string;
  readonly source: AliasSource;
  readonly createdBy: string | null;
  readonly createdAt: Date;
  readonly deletedAt: Date | null;
}

/** An uploaded media asset. Bytes live in object storage, never in the database. */
export interface MediaAsset {
  readonly id: string;
  readonly teamId: string;
  readonly membershipId: string;
  readonly purpose: MediaPurpose;
  readonly storageKey: string;
  readonly contentType: string;
  readonly byteSize: number;
  readonly width: number | null;
  readonly height: number | null;
  readonly scanStatus: MediaScanStatus;
  readonly createdBy: string | null;
  readonly createdAt: Date;
  readonly deletedAt: Date | null;
}

// --- Media storage port ------------------------------------------------------

export interface SignedUrl {
  readonly url: string;
  readonly expiresAt: Date;
}

export interface SignedUrlRequest {
  readonly storageKey: string;
  readonly contentType: string;
  readonly now: Date;
}

export interface SignedDownloadRequest {
  readonly storageKey: string;
  readonly now: Date;
}

/**
 * Object-storage boundary. Produces short-lived signed URLs for private upload
 * and download; the concrete adapter owns any storage SDK. No bytes ever pass
 * through the application layer.
 */
export interface MediaStoragePort {
  createUploadUrl(request: SignedUrlRequest): SignedUrl;
  createDownloadUrl(request: SignedDownloadRequest): SignedUrl;
}

// --- Shaped views (field-level privacy) --------------------------------------

/** The four privacy tiers plus the self flag that shape a member view. */
export interface ViewerContext {
  readonly tier: MemberViewTier;
  readonly isSelf: boolean;
}

/** A viewer's resolved access to a member: how to shape reads + whether to manage. */
export interface MemberAccess {
  readonly viewer: ViewerContext;
  readonly canManage: boolean;
}

/** A member profile shaped for a specific audience. Absent fields are redacted. */
export interface MemberView {
  readonly membershipId: string;
  readonly teamId: string;
  readonly audience: MemberAudience;
  readonly status: MembershipStatus;
  readonly displayName: string;
  readonly nickname: string | null;
  readonly positions: readonly string[];
  readonly jerseyNumber: number | null;
  readonly division: string | null;
  readonly hasAvatar: boolean;
  readonly preferredName: string | null;
  readonly fullNameAr: string | null;
  readonly gender: PlayerGender | null;
  readonly fullName: string | null;
  readonly jerseySize: string | null;
  readonly email: string | null;
  readonly phone: string | null;
  readonly heightCm: number | null;
  readonly weightKg: number | null;
  readonly ageClassification: AgeClassification | null;
  readonly dateOfBirth: string | null;
  readonly statusReason: string | null;
  readonly createdBy: string | null;
  readonly updatedBy: string | null;
  readonly version: number | null;
}

/** A coarse directory row for the bounded member list. */
export interface MemberDirectoryItem {
  readonly membershipId: string;
  readonly teamId: string;
  readonly status: MembershipStatus;
  readonly displayName: string;
  readonly nickname: string | null;
  readonly jerseyNumber: number | null;
  readonly positions: readonly string[];
  readonly hasAvatar: boolean;
}

// --- Pagination --------------------------------------------------------------

export interface PageRequest {
  readonly limit: number;
  readonly offset: number;
}

export interface ListMembersResult {
  readonly items: readonly MemberDirectoryItem[];
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
}

export interface ListHistoryResult {
  readonly items: readonly MembershipStatusEvent[];
}

// --- Response projections (internal fields stripped) -------------------------

/** Alias projection returned by the API — no normalized key or soft-delete state. */
export interface AliasResponse {
  readonly id: string;
  readonly membershipId: string;
  readonly alias: string;
  readonly source: AliasSource;
  readonly createdAt: Date;
}

export interface ListAliasesResponse {
  readonly items: readonly AliasResponse[];
}

/** Media projection returned by the API — the private storage key is never exposed. */
export interface MediaAssetResponse {
  readonly id: string;
  readonly membershipId: string;
  readonly purpose: MediaPurpose;
  readonly contentType: string;
  readonly byteSize: number;
  readonly width: number | null;
  readonly height: number | null;
  readonly scanStatus: MediaScanStatus;
  readonly createdAt: Date;
}

// --- Application command models (built by controllers from DTOs) -------------

export interface ProfileInput {
  readonly fullName: string;
  readonly preferredName: string | null;
  readonly fullNameAr: string | null;
  readonly nickname: string | null;
  readonly email: string | null;
  readonly phone: string | null;
  readonly gender: PlayerGender | null;
  readonly division: string | null;
  readonly positions: readonly string[];
  readonly jerseyNumber: number | null;
  readonly jerseySize: string | null;
  readonly heightCm: number | null;
  readonly weightKg: number | null;
  readonly dateOfBirth: string | null;
}

export interface InviteMemberCommand {
  readonly userId: string | null;
  readonly seasonId: string | null;
  readonly profile: ProfileInput;
}

export interface UpdateProfileCommand {
  readonly profile: ProfileInput;
  readonly expectedVersion: number;
}

export interface TransitionCommand {
  readonly reason: string | null;
  readonly effectiveAt: string | null;
}

/** Resolved inputs for a single lifecycle transition, threaded through builders. */
export interface TransitionContext {
  readonly current: Membership;
  readonly targetStatus: MembershipStatus;
  readonly reason: string | null;
  readonly effectiveAt: Date;
  readonly actorUserId: string | null;
  readonly now: Date;
}

export interface AddAliasCommand {
  readonly alias: string;
  readonly source: AliasSource | null;
}

export interface RequestAvatarCommand {
  readonly contentType: string;
  readonly byteSize: number;
  readonly width: number | null;
  readonly height: number | null;
}

export interface RecordScanCommand {
  readonly outcome: MediaScanStatus;
}

export interface AvatarUploadTicket {
  readonly mediaId: string;
  readonly storageKey: string;
  readonly uploadUrl: string;
  readonly expiresAt: Date;
}

export interface AvatarAccess {
  readonly url: string | null;
  readonly expiresAt: Date | null;
}

// --- Persistence write models ------------------------------------------------

export interface NewMembership {
  readonly id: string;
  readonly teamId: string;
  readonly seasonId: string | null;
  readonly userId: string | null;
  readonly status: MembershipStatus;
  readonly statusEffectiveAt: Date;
  readonly createdBy: string | null;
  readonly now: Date;
}

export interface MembershipStatusChange {
  readonly id: string;
  readonly toStatus: MembershipStatus;
  readonly reason: string | null;
  readonly statusEffectiveAt: Date;
  readonly joinedAt: Date | null;
  readonly leftAt: Date | null;
  readonly anonymizedAt: Date | null;
  readonly updatedBy: string | null;
  readonly expectedVersion: number;
  readonly now: Date;
}

/**
 * Link a pre-created invited membership to its freshly created account and
 * activate it in one guarded write (invitation acceptance). The update only
 * applies while the row is still `invited`, unlinked, and at the expected
 * version, so a concurrent change can never be overwritten.
 */
export interface MembershipClaim {
  readonly id: string;
  readonly userId: string;
  readonly statusEffectiveAt: Date;
  readonly expectedVersion: number;
  readonly now: Date;
}

export interface NewMemberProfile {
  readonly id: string;
  readonly membershipId: string;
  readonly teamId: string;
  readonly profile: ProfileInput;
  readonly createdBy: string | null;
  readonly now: Date;
}

export interface MemberProfileUpdate {
  readonly membershipId: string;
  readonly profile: ProfileInput;
  readonly updatedBy: string | null;
  readonly expectedVersion: number;
  readonly now: Date;
}

export interface ProfileRedaction {
  readonly membershipId: string;
  readonly redactedName: string;
  readonly updatedBy: string | null;
  readonly now: Date;
}

export interface NewStatusEvent {
  readonly id: string;
  readonly membershipId: string;
  readonly fromStatus: MembershipStatus | null;
  readonly toStatus: MembershipStatus;
  readonly reason: string | null;
  readonly actorUserId: string | null;
  readonly effectiveAt: Date;
  readonly now: Date;
}

export interface NewAlias {
  readonly id: string;
  readonly membershipId: string;
  readonly teamId: string;
  readonly alias: string;
  readonly normalizedAlias: string;
  readonly source: AliasSource;
  readonly createdBy: string | null;
  readonly now: Date;
}

export interface NewMediaAsset {
  readonly id: string;
  readonly teamId: string;
  readonly membershipId: string;
  readonly purpose: MediaPurpose;
  readonly storageKey: string;
  readonly contentType: string;
  readonly byteSize: number;
  readonly width: number | null;
  readonly height: number | null;
  readonly createdBy: string | null;
  readonly now: Date;
}

export interface NewAuditEvent {
  readonly id: string;
  readonly eventType: string;
  readonly actorUserId: string | null;
  readonly context: Readonly<Record<string, string | number | boolean | null>>;
  readonly occurredAt: Date;
}

/** A jersey number already reserved by an active member in a scope. */
export interface JerseyReservation {
  readonly membershipId: string;
  readonly jerseyNumber: number;
}

/**
 * Claim request for invitation acceptance: link every invited, unlinked
 * membership matching this email (optionally within one team) to the freshly
 * created account. Runs inside the caller's acceptance transaction.
 */
export interface ClaimInvitedMembershipsCommand {
  readonly email: string;
  readonly teamId: string | null;
  readonly userId: string;
  readonly now: Date;
}

/** One membership linked and activated by an invitation acceptance. */
export interface ClaimedMembership {
  readonly membershipId: string;
  readonly teamId: string;
  readonly seasonId: string | null;
}

/**
 * One membership of the calling principal, enriched with the team and season
 * labels a client needs to choose an active team context. Season fields are
 * null when the team has no resolvable (non-archived) season — never a blank
 * placeholder. Read-only projection: it is never persisted in this shape.
 */
export interface MembershipContext {
  readonly membershipId: string;
  readonly teamId: string;
  readonly teamSlug: string;
  readonly teamName: string;
  readonly seasonId: string | null;
  readonly seasonSlug: string | null;
  readonly seasonName: string | null;
  readonly status: MembershipStatus;
  readonly joinedAt: Date | null;
}

/**
 * Membership-scoped role projection: the role slugs this member holds inside the
 * team, plus the slugs the acting principal may set (their privilege ceiling).
 * Roles themselves are owned by the RBAC module; this is only the membership
 * addressing of them.
 */
export interface MemberRolesView {
  readonly membershipId: string;
  readonly roles: readonly string[];
  readonly assignableRoles: readonly string[];
}

/** A bounded roster count with the instant that makes it fresh, or nulls. */
export interface MemberCountSignal {
  readonly count: number | null;
  readonly asOf: Date | null;
}

/**
 * Read-only members signals published for cross-module dashboards. Completeness
 * is a percentage projected from the profile on read — never stored — and every
 * value is null when nothing has been measured, never a zero.
 */
export interface MemberDashboardSignals {
  readonly profileCompletenessPercent: number | null;
  readonly profileAsOf: Date | null;
  readonly invitedMembers: MemberCountSignal;
}

export interface MemberSignalScope {
  readonly teamId: string;
  readonly membershipId: string | null;
}

/** The profile-completeness half of the members dashboard signals. */
export interface MemberProfileSignal {
  readonly profileCompletenessPercent: number | null;
  readonly profileAsOf: Date | null;
}
