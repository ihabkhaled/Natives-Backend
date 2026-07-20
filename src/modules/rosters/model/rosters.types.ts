import type {
  ConstraintCode,
  ConstraintSeverity,
  EntryFlagCode,
  RosterAudience,
  RosterAvailabilitySource,
  RosterAvailabilityStatus,
  RosterDivision,
  RosterEntryRole,
  RosterEntryStatus,
  RosterGenderBucket,
  RosterKind,
  RosterLine,
  RosterMemberStatus,
  RosterPosition,
  RosterStatus,
  RosterTransition,
  SnapshotReason,
} from './rosters.enums';

// --- Pagination --------------------------------------------------------------

export interface PageRequest {
  readonly limit: number;
  readonly offset: number;
}

export interface PagedResult<TItem> {
  readonly items: readonly TItem[];
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
}

// --- Roster aggregate --------------------------------------------------------

/** The full persisted roster aggregate (competition or match). */
export interface Roster {
  readonly rosterId: string;
  readonly teamId: string;
  readonly seasonId: string;
  readonly competitionId: string;
  readonly fixtureId: string | null;
  readonly squadId: string | null;
  readonly sourceRosterId: string | null;
  readonly supersedesRosterId: string | null;
  readonly currentSnapshotId: string | null;
  readonly rosterKind: RosterKind;
  readonly name: string;
  readonly status: RosterStatus;
  readonly division: RosterDivision;
  readonly minSize: number;
  readonly maxSize: number;
  readonly minWomen: number | null;
  readonly requireCaptain: boolean;
  readonly policyVersion: string;
  readonly selectionDeadline: Date | null;
  readonly notes: string | null;
  readonly revision: number;
  readonly recordVersion: number;
  readonly createdBy: string | null;
  readonly publishedBy: string | null;
  readonly publishedAt: Date | null;
  readonly lockedBy: string | null;
  readonly lockedAt: Date | null;
  readonly revisedBy: string | null;
  readonly revisedAt: Date | null;
  readonly revisionReason: string | null;
  readonly archivedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** The server-validated composition rules a roster is measured against. */
export interface RosterConstraints {
  readonly division: RosterDivision;
  readonly minSize: number;
  readonly maxSize: number;
  readonly minWomen: number | null;
  readonly requireCaptain: boolean;
}

/** Author-supplied content of a competition roster (create command). */
export interface CompetitionRosterContent {
  readonly competitionId: string;
  readonly squadId: string | null;
  readonly name: string;
  readonly division: RosterDivision;
  readonly minSize: number;
  readonly maxSize: number;
  readonly minWomen: number | null;
  readonly requireCaptain: boolean;
  readonly selectionDeadline: string | null;
  readonly notes: string | null;
}

/** Author-supplied content of a match roster (create command). */
export interface MatchRosterContent {
  readonly fixtureId: string;
  readonly sourceRosterId: string | null;
  readonly name: string;
  readonly division: RosterDivision;
  readonly minSize: number;
  readonly maxSize: number;
  readonly minWomen: number | null;
  readonly requireCaptain: boolean;
  readonly notes: string | null;
}

/** A fully-resolved new roster row ready for insertion. */
export interface NewRoster {
  readonly id: string;
  readonly teamId: string;
  readonly seasonId: string;
  readonly competitionId: string;
  readonly fixtureId: string | null;
  readonly squadId: string | null;
  readonly sourceRosterId: string | null;
  readonly supersedesRosterId: string | null;
  readonly rosterKind: RosterKind;
  readonly name: string;
  readonly division: RosterDivision;
  readonly minSize: number;
  readonly maxSize: number;
  readonly minWomen: number | null;
  readonly requireCaptain: boolean;
  readonly policyVersion: string;
  readonly selectionDeadline: string | null;
  readonly notes: string | null;
  readonly revision: number;
  readonly createdBy: string;
  readonly now: Date;
}

/** An optimistic-version-guarded lifecycle status change of a roster. */
export interface RosterStatusChange {
  readonly id: string;
  readonly teamId: string;
  readonly expectedRecordVersion: number;
  readonly toStatus: RosterStatus;
  readonly publishedBy: string | null;
  readonly publishedAt: Date | null;
  readonly lockedBy: string | null;
  readonly lockedAt: Date | null;
  readonly revisedBy: string | null;
  readonly revisedAt: Date | null;
  readonly revisionReason: string | null;
  readonly archivedAt: Date | null;
  readonly now: Date;
}

export interface CreateCompetitionRosterCommand {
  readonly content: CompetitionRosterContent;
}

export interface CreateMatchRosterCommand {
  readonly content: MatchRosterContent;
}

export interface TransitionRosterCommand {
  readonly transition: RosterTransition;
  readonly expectedRecordVersion: number;
}

export interface LockRosterCommand {
  readonly expectedRecordVersion: number;
}

export interface ReviseRosterCommand {
  readonly reason: string;
  readonly expectedRecordVersion: number;
}

export type RosterPage = PagedResult<Roster>;

/** Bounded, allow-listed filter for the roster list. */
export interface RosterListFilter {
  readonly competitionId: string | null;
  readonly fixtureId: string | null;
  readonly rosterKind: RosterKind | null;
}

/** The loosely-typed transport shape of the roster list filter. */
export interface RosterListFilterInput {
  readonly competitionId?: string | null;
  readonly fixtureId?: string | null;
  readonly rosterKind?: RosterKind | null;
}

// --- Entries -----------------------------------------------------------------

/** The full persisted roster entry. */
export interface RosterEntry {
  readonly entryId: string;
  readonly rosterId: string;
  readonly teamId: string;
  readonly membershipId: string;
  readonly jerseyNumber: number | null;
  readonly entryRole: RosterEntryRole;
  readonly lineAssignment: RosterLine;
  readonly fieldPosition: RosterPosition;
  readonly genderBucket: RosterGenderBucket;
  readonly status: RosterEntryStatus;
  readonly availability: RosterAvailabilityStatus | null;
  readonly selectionReason: string | null;
  readonly constraintOverridden: boolean;
  readonly overrideReason: string | null;
  readonly overriddenBy: string | null;
  readonly selectedBy: string | null;
  readonly removedBy: string | null;
  readonly removedAt: Date | null;
  readonly removalReason: string | null;
  readonly recordVersion: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** A resolved entry write (insert-or-reinstate an active roster entry). */
export interface RosterEntryWrite {
  readonly id: string;
  readonly rosterId: string;
  readonly teamId: string;
  readonly membershipId: string;
  readonly jerseyNumber: number | null;
  readonly entryRole: RosterEntryRole;
  readonly lineAssignment: RosterLine;
  readonly fieldPosition: RosterPosition;
  readonly genderBucket: RosterGenderBucket;
  readonly availability: RosterAvailabilityStatus | null;
  readonly selectionReason: string | null;
  readonly constraintOverridden: boolean;
  readonly overrideReason: string | null;
  readonly overriddenBy: string | null;
  readonly selectedBy: string;
  readonly now: Date;
}

/** A resolved soft withdrawal of an entry (kept so history is never deleted). */
export interface RosterEntryRemoval {
  readonly rosterId: string;
  readonly membershipId: string;
  readonly removedBy: string;
  readonly reason: string | null;
  readonly now: Date;
}

/** Author-supplied entry content. */
export interface RosterEntryContent {
  readonly membershipId: string;
  readonly jerseyNumber: number | null;
  readonly entryRole: RosterEntryRole;
  readonly lineAssignment: RosterLine;
  readonly fieldPosition: RosterPosition;
  readonly selectionReason: string | null;
}

/** The explicit human override attached when rostering a flagged member. */
export interface RosterOverride {
  readonly overrideReason: string;
}

export interface AddRosterEntryCommand {
  readonly content: RosterEntryContent;
  readonly override: RosterOverride | null;
}

export interface RemoveRosterEntryCommand {
  readonly membershipId: string;
  readonly reason: string | null;
}

export type RosterEntryPage = PagedResult<RosterEntry>;

// --- Availability ------------------------------------------------------------

/** The full persisted roster availability declaration. */
export interface RosterAvailabilityRecord {
  readonly availabilityId: string;
  readonly rosterId: string;
  readonly teamId: string;
  readonly membershipId: string;
  readonly availability: RosterAvailabilityStatus;
  readonly reason: string | null;
  readonly source: RosterAvailabilitySource;
  readonly declaredBy: string | null;
  readonly recordVersion: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** A resolved availability upsert (one declaration per member per roster). */
export interface RosterAvailabilityUpsert {
  readonly id: string;
  readonly rosterId: string;
  readonly teamId: string;
  readonly membershipId: string;
  readonly availability: RosterAvailabilityStatus;
  readonly reason: string | null;
  readonly source: RosterAvailabilitySource;
  readonly declaredBy: string;
  readonly now: Date;
}

export interface DeclareRosterAvailabilityCommand {
  readonly availability: RosterAvailabilityStatus;
  readonly reason: string | null;
}

export type RosterAvailabilityPage = PagedResult<RosterAvailabilityRecord>;

// --- Snapshots ---------------------------------------------------------------

/**
 * One frozen entry inside a snapshot. Ids and classifications only — a snapshot
 * is a durable record of WHO was selected and HOW, never a copy of personal
 * detail, so it can be retained without duplicating profile data.
 */
export interface RosterSnapshotEntry {
  readonly membershipId: string;
  readonly jerseyNumber: number | null;
  readonly entryRole: RosterEntryRole;
  readonly lineAssignment: RosterLine;
  readonly fieldPosition: RosterPosition;
  readonly genderBucket: RosterGenderBucket;
  readonly availability: RosterAvailabilityStatus | null;
  readonly constraintOverridden: boolean;
}

/** The immutable point-in-time record of a roster. Never rewritten. */
export interface RosterSnapshot {
  readonly snapshotId: string;
  readonly rosterId: string;
  readonly teamId: string;
  readonly seasonId: string;
  readonly competitionId: string;
  readonly fixtureId: string | null;
  readonly rosterKind: RosterKind;
  readonly revision: number;
  readonly reason: SnapshotReason;
  readonly rosterStatus: RosterStatus;
  readonly entryCount: number;
  readonly checksum: string;
  readonly entries: readonly RosterSnapshotEntry[];
  readonly takenBy: string | null;
  readonly takenAt: Date;
}

/** A fully-resolved snapshot row ready for its single, append-only insert. */
export interface NewRosterSnapshot {
  readonly id: string;
  readonly rosterId: string;
  readonly teamId: string;
  readonly seasonId: string;
  readonly competitionId: string;
  readonly fixtureId: string | null;
  readonly rosterKind: RosterKind;
  readonly revision: number;
  readonly reason: SnapshotReason;
  readonly rosterStatus: RosterStatus;
  readonly entryCount: number;
  readonly checksum: string;
  readonly entries: readonly RosterSnapshotEntry[];
  readonly takenBy: string;
  readonly now: Date;
}

export type RosterSnapshotPage = PagedResult<RosterSnapshot>;

// --- Candidates (pure inputs) ------------------------------------------------

/**
 * The raw inputs the entry-eligibility policy consumes for one member. The squad
 * membership flag and the availability declaration are classifications only —
 * never medical detail or an excuse note.
 */
export interface RosterCandidate {
  readonly membershipId: string;
  readonly memberStatus: RosterMemberStatus;
  readonly gender: string | null;
  readonly jerseyNumber: number | null;
  readonly availability: RosterAvailabilityStatus | null;
  readonly selectedInSquad: boolean;
}

/** One reason a member needs an explicit override to be rostered. */
export interface EntryFlag {
  readonly code: EntryFlagCode;
}

// --- Composition / validation ------------------------------------------------

/** The counted shape of a roster's active entries. */
export interface RosterComposition {
  readonly selected: number;
  readonly women: number;
  readonly men: number;
  readonly mixed: number;
  readonly unknownGender: number;
  readonly offense: number;
  readonly defense: number;
  readonly flexible: number;
  readonly captains: number;
  readonly spiritCaptains: number;
  readonly missingJersey: number;
  readonly duplicateJerseys: number;
  readonly unavailableSelected: number;
}

/** One explainable constraint outcome. `count` is null when not measurable. */
export interface ConstraintViolation {
  readonly code: ConstraintCode;
  readonly severity: ConstraintSeverity;
  readonly count: number | null;
}

/** The full server-side validation preview of a roster. */
export interface RosterValidationReport {
  readonly rosterId: string;
  readonly policyVersion: string;
  readonly status: RosterStatus;
  readonly composition: RosterComposition;
  readonly violations: readonly ConstraintViolation[];
  readonly publishable: boolean;
}

// --- Notification audience ---------------------------------------------------

/** The privacy-aware publish audience decision. */
export interface RosterAudiencePlan {
  readonly audience: RosterAudience;
  readonly selectedCount: number;
  readonly notSelectedCount: number;
}

// --- Transport inputs --------------------------------------------------------

export interface CompetitionRosterContentInput {
  readonly competitionId: string;
  readonly squadId?: string | null;
  readonly name: string;
  readonly division?: RosterDivision | null;
  readonly minSize?: number | null;
  readonly maxSize?: number | null;
  readonly minWomen?: number | null;
  readonly requireCaptain?: boolean | null;
  readonly selectionDeadline?: string | null;
  readonly notes?: string | null;
}

export interface MatchRosterContentInput {
  readonly fixtureId: string;
  readonly sourceRosterId?: string | null;
  readonly name: string;
  readonly division?: RosterDivision | null;
  readonly minSize?: number | null;
  readonly maxSize?: number | null;
  readonly minWomen?: number | null;
  readonly requireCaptain?: boolean | null;
  readonly notes?: string | null;
}

export interface RosterEntryContentInput {
  readonly membershipId: string;
  readonly jerseyNumber?: number | null;
  readonly entryRole?: RosterEntryRole | null;
  readonly lineAssignment?: RosterLine | null;
  readonly fieldPosition?: RosterPosition | null;
  readonly selectionReason?: string | null;
}

/** The resolved team/season/competition scope of a roster operation. */
export interface RosterScope {
  readonly competitionId: string;
  readonly seasonId: string;
}
