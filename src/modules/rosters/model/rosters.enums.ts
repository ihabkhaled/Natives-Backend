/**
 * Enumerations for competition rosters, match rosters, availability, locks, and
 * snapshots (UN-502). Every enum ships a `*_VALUES` tuple so mappers can validate
 * a raw database string against the closed set without a hand-maintained second
 * list.
 *
 * The lifecycle vocabulary is deliberately append-only: a `locked` roster is
 * frozen, and reopening it produces a NEW `revised`-superseded record rather than
 * an in-place edit, so a published or locked roster is always recoverable exactly
 * as it stood.
 */

/** Whether a roster covers a whole competition or one scheduled fixture. */
export enum RosterKind {
  Competition = 'competition',
  Match = 'match',
}

export const ROSTER_KIND_VALUES: readonly RosterKind[] =
  Object.values(RosterKind);

/**
 * Lifecycle of a roster. `draft` is the editable working selection; `published`
 * is the visible, notified selection; `locked` freezes it and is the immutable
 * record matches are played against; `revised` marks a roster superseded by a
 * successor revision (it is never edited afterwards); `archived` is the read-only
 * historical end state.
 */
export enum RosterStatus {
  Draft = 'draft',
  Published = 'published',
  Locked = 'locked',
  Revised = 'revised',
  Archived = 'archived',
}

export const ROSTER_STATUS_VALUES: readonly RosterStatus[] =
  Object.values(RosterStatus);

/**
 * The lifecycle verbs the plain transition endpoint accepts. Locking and revising
 * are separate, separately-permissioned endpoints (`roster.lock`), so they are
 * deliberately absent here.
 */
export enum RosterTransition {
  Publish = 'publish',
  Archive = 'archive',
}

export const ROSTER_TRANSITION_VALUES: readonly RosterTransition[] =
  Object.values(RosterTransition);

/** The role a rostered person holds. One captain and one spirit captain. */
export enum RosterEntryRole {
  Player = 'player',
  Captain = 'captain',
  SpiritCaptain = 'spirit_captain',
  Coach = 'coach',
}

export const ROSTER_ENTRY_ROLE_VALUES: readonly RosterEntryRole[] =
  Object.values(RosterEntryRole);

/** Whether a roster entry is active or was withdrawn (kept for history). */
export enum RosterEntryStatus {
  Selected = 'selected',
  Withdrawn = 'withdrawn',
}

export const ROSTER_ENTRY_STATUS_VALUES: readonly RosterEntryStatus[] =
  Object.values(RosterEntryStatus);

/** Ultimate line assignment. `any` is the honest default, never a guess. */
export enum RosterLine {
  Offense = 'offense',
  Defense = 'defense',
  Any = 'any',
}

export const ROSTER_LINE_VALUES: readonly RosterLine[] =
  Object.values(RosterLine);

/** Field position. `unspecified` means not recorded — never inferred. */
export enum RosterPosition {
  Handler = 'handler',
  Cutter = 'cutter',
  Hybrid = 'hybrid',
  Unspecified = 'unspecified',
}

export const ROSTER_POSITION_VALUES: readonly RosterPosition[] =
  Object.values(RosterPosition);

/** The competition division a roster is registered in. */
export enum RosterDivision {
  Open = 'open',
  Women = 'women',
  Mixed = 'mixed',
  Unspecified = 'unspecified',
}

export const ROSTER_DIVISION_VALUES: readonly RosterDivision[] =
  Object.values(RosterDivision);

/**
 * Gender buckets used by the advisory division ratio rule. Raw self-declared
 * profile genders are bucketed here; `unknown` is the null-not-zero outcome for
 * an undeclared gender and is never counted as any other bucket.
 */
export enum RosterGenderBucket {
  Men = 'men',
  Women = 'women',
  Mixed = 'mixed',
  Unknown = 'unknown',
}

export const ROSTER_GENDER_BUCKET_VALUES: readonly RosterGenderBucket[] =
  Object.values(RosterGenderBucket);

/** A member's own going / not-going declaration for a roster. */
export enum RosterAvailabilityStatus {
  Available = 'available',
  Unavailable = 'unavailable',
  Tentative = 'tentative',
}

export const ROSTER_AVAILABILITY_STATUS_VALUES: readonly RosterAvailabilityStatus[] =
  Object.values(RosterAvailabilityStatus);

/** Who recorded an availability declaration. */
export enum RosterAvailabilitySource {
  Self = 'self',
  Coach = 'coach',
}

export const ROSTER_AVAILABILITY_SOURCE_VALUES: readonly RosterAvailabilitySource[] =
  Object.values(RosterAvailabilitySource);

/** Why an immutable snapshot was taken. */
export enum SnapshotReason {
  Published = 'published',
  Locked = 'locked',
  Revised = 'revised',
}

export const SNAPSHOT_REASON_VALUES: readonly SnapshotReason[] =
  Object.values(SnapshotReason);

/**
 * Server-validated composition constraints. Every code is explainable and is
 * evaluated at draft (as a preview) and enforced again at publish and lock, so a
 * roster can never be frozen in a state the rules reject.
 */
export enum ConstraintCode {
  MinSize = 'min_size',
  MaxSize = 'max_size',
  MissingCaptain = 'missing_captain',
  JerseyCollision = 'jersey_collision',
  MissingJersey = 'missing_jersey',
  GenderRatio = 'gender_ratio',
  LineBalance = 'line_balance',
  UnavailableSelected = 'unavailable_selected',
}

export const CONSTRAINT_CODE_VALUES: readonly ConstraintCode[] =
  Object.values(ConstraintCode);

/** An `error` blocks publish and lock; a `warning` is advisory only. */
export enum ConstraintSeverity {
  Error = 'error',
  Warning = 'warning',
}

export const CONSTRAINT_SEVERITY_VALUES: readonly ConstraintSeverity[] =
  Object.values(ConstraintSeverity);

/**
 * Why adding a member to a roster needs an explicit, reasoned human override. A
 * flag never excludes anyone automatically — it forces a conscious decision.
 */
export enum EntryFlagCode {
  MembershipInactive = 'membership_inactive',
  MembershipSuspended = 'membership_suspended',
  DeclaredUnavailable = 'declared_unavailable',
  NotInSquad = 'not_in_squad',
}

export const ENTRY_FLAG_CODE_VALUES: readonly EntryFlagCode[] =
  Object.values(EntryFlagCode);

/**
 * Membership lifecycle status mirrored from the members module for the roster
 * candidate pool. The raw database string is parsed into this closed set so the
 * status rule is a pure, fully branch-tested mapping rather than SQL.
 */
export enum RosterMemberStatus {
  Invited = 'invited',
  Active = 'active',
  Inactive = 'inactive',
  Suspended = 'suspended',
  Left = 'left',
  Archived = 'archived',
  Anonymized = 'anonymized',
}

export const ROSTER_MEMBER_STATUS_VALUES: readonly RosterMemberStatus[] =
  Object.values(RosterMemberStatus);

/** Who a publish notification reaches, decided by the privacy-aware policy. */
export enum RosterAudience {
  None = 'none',
  SelectedOnly = 'selected_only',
  SelectedAndNotSelected = 'selected_and_not_selected',
}

export const ROSTER_AUDIENCE_VALUES: readonly RosterAudience[] =
  Object.values(RosterAudience);
