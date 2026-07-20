/**
 * Enumerations for season squads, eligibility signals, availability, and selection
 * (UN-501). Every enum ships a `*_VALUES` tuple so mappers can validate a raw
 * database string against the closed set without a hand-maintained second list.
 *
 * The eligibility signal vocabulary is deliberately advisory: a `Failed` or
 * `Warning` signal never removes a player from selection automatically — it flags
 * the candidate so an authorized human can decide, and an explicit `Overridden`
 * outcome is recorded when a flagged player is selected. `Unknown` is the honest
 * null-not-zero outcome for a signal with no data (e.g. no attendance yet).
 */

/**
 * Lifecycle of a squad. A `draft` is the editable working pool; `published` is the
 * visible, notified selection; `locked` freezes the roster past the selection
 * deadline; `archived` is a read-only historical record. Revising a published or
 * locked squad returns it to `draft` and bumps its revision so history is kept.
 */
export enum SquadStatus {
  Draft = 'draft',
  Published = 'published',
  Locked = 'locked',
  Archived = 'archived',
}

export const SQUAD_STATUS_VALUES: readonly SquadStatus[] =
  Object.values(SquadStatus);

/** A requested lifecycle transition verb for a squad. */
export enum SquadTransition {
  Publish = 'publish',
  Lock = 'lock',
  Revise = 'revise',
  Archive = 'archive',
}

export const SQUAD_TRANSITION_VALUES: readonly SquadTransition[] =
  Object.values(SquadTransition);

/** The role a selected player holds in the squad. One captain per squad. */
export enum SelectionRole {
  Player = 'player',
  Captain = 'captain',
  ViceCaptain = 'vice_captain',
}

export const SELECTION_ROLE_VALUES: readonly SelectionRole[] =
  Object.values(SelectionRole);

/** Whether a squad selection is currently active or has been removed (kept). */
export enum SelectionStatus {
  Selected = 'selected',
  Removed = 'removed',
}

export const SELECTION_STATUS_VALUES: readonly SelectionStatus[] =
  Object.values(SelectionStatus);

/** Append-only selection history event kinds. */
export enum SelectionEventType {
  Selected = 'selected',
  Removed = 'removed',
  RoleChanged = 'role_changed',
  Overridden = 'overridden',
}

export const SELECTION_EVENT_TYPE_VALUES: readonly SelectionEventType[] =
  Object.values(SelectionEventType);

/** A member's self-declared availability for a squad's competition/period. */
export enum AvailabilityStatus {
  Available = 'available',
  Unavailable = 'unavailable',
  Tentative = 'tentative',
}

export const AVAILABILITY_STATUS_VALUES: readonly AvailabilityStatus[] =
  Object.values(AvailabilityStatus);

/** Who recorded an availability declaration. */
export enum AvailabilitySource {
  Self = 'self',
  Coach = 'coach',
}

export const AVAILABILITY_SOURCE_VALUES: readonly AvailabilitySource[] =
  Object.values(AvailabilitySource);

/**
 * The outcome of one eligibility signal. Advisory only — never a gate. `Passed`
 * met the signal; `Warning` flags a soft concern (e.g. attendance under the
 * threshold, no jersey); `Failed` flags a hard concern (e.g. suspended, not
 * registered) that still requires an explicit human override to select, never an
 * automatic exclusion; `Unknown` has no data (null-not-zero); `Overridden` is a
 * flagged signal a permitted human consciously accepted at selection.
 */
export enum SignalStatus {
  Passed = 'passed',
  Warning = 'warning',
  Failed = 'failed',
  Unknown = 'unknown',
  Overridden = 'overridden',
}

export const SIGNAL_STATUS_VALUES: readonly SignalStatus[] =
  Object.values(SignalStatus);

/** The eligibility signals computed for a candidate. Each is explainable. */
export enum SignalCode {
  ActiveStatus = 'active_status',
  Registration = 'registration',
  Attendance = 'attendance',
  Availability = 'availability',
  Injury = 'injury',
  Jersey = 'jersey',
}

export const SIGNAL_CODE_VALUES: readonly SignalCode[] =
  Object.values(SignalCode);

/**
 * Membership lifecycle status mirrored from the members module for the candidate
 * pool. The squad module reads the shared `memberships` table and parses the raw
 * status into this closed set so the active-status signal is a pure, fully
 * branch-tested mapping rather than an untested SQL expression.
 */
export enum CandidateStatus {
  Invited = 'invited',
  Active = 'active',
  Inactive = 'inactive',
  Suspended = 'suspended',
  Left = 'left',
  Archived = 'archived',
  Anonymized = 'anonymized',
}

export const CANDIDATE_STATUS_VALUES: readonly CandidateStatus[] =
  Object.values(CandidateStatus);

/**
 * Gender buckets for the squad gender-ratio balance signal. Raw profile genders
 * (`man`/`woman`/`nonbinary`/`undisclosed`/null) are bucketed here; the ratio is
 * an advisory balance indicator, never a selection gate.
 */
export enum GenderBucket {
  Men = 'men',
  Women = 'women',
  Mixed = 'mixed',
  Unknown = 'unknown',
}

export const GENDER_BUCKET_VALUES: readonly GenderBucket[] =
  Object.values(GenderBucket);
