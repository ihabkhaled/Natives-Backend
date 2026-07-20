import type {
  AvailabilitySource,
  AvailabilityStatus,
  CandidateStatus,
  SelectionRole,
  SelectionStatus,
  SignalCode,
  SignalStatus,
  SquadStatus,
  SquadTransition,
} from './squads.enums';

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

// --- Squad aggregate ---------------------------------------------------------

/** The full persisted squad aggregate. */
export interface Squad {
  readonly squadId: string;
  readonly teamId: string;
  readonly seasonId: string;
  readonly competitionId: string | null;
  readonly name: string;
  readonly status: SquadStatus;
  readonly attendanceThresholdPct: number;
  readonly policyVersion: string;
  readonly selectionDeadline: Date | null;
  readonly notes: string | null;
  readonly revision: number;
  readonly recordVersion: number;
  readonly createdBy: string | null;
  readonly publishedBy: string | null;
  readonly publishedAt: Date | null;
  readonly lockedAt: Date | null;
  readonly archivedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** Author-supplied content of a squad (create command). */
export interface SquadContent {
  readonly name: string;
  readonly seasonId: string;
  readonly competitionId: string | null;
  readonly attendanceThresholdPct: number;
  readonly selectionDeadline: string | null;
  readonly notes: string | null;
}

/** A fully-resolved new squad row ready for insertion. */
export interface NewSquad {
  readonly id: string;
  readonly teamId: string;
  readonly content: SquadContent;
  readonly policyVersion: string;
  readonly createdBy: string;
  readonly now: Date;
}

/** An optimistic-version-guarded lifecycle status change of a squad. */
export interface SquadStatusChange {
  readonly id: string;
  readonly teamId: string;
  readonly expectedRecordVersion: number;
  readonly toStatus: SquadStatus;
  readonly bumpRevision: boolean;
  readonly publishedBy: string | null;
  readonly publishedAt: Date | null;
  readonly lockedAt: Date | null;
  readonly archivedAt: Date | null;
  readonly now: Date;
}

export interface CreateSquadCommand {
  readonly content: SquadContent;
}

export interface TransitionSquadCommand {
  readonly transition: SquadTransition;
  readonly expectedRecordVersion: number;
}

export type SquadPage = PagedResult<Squad>;

// --- Selection ---------------------------------------------------------------

/** The full persisted squad-selection row. */
export interface SquadSelection {
  readonly selectionId: string;
  readonly squadId: string;
  readonly teamId: string;
  readonly membershipId: string;
  readonly selectionRole: SelectionRole;
  readonly status: SelectionStatus;
  readonly reason: string | null;
  readonly eligibilityOverridden: boolean;
  readonly overrideReason: string | null;
  readonly overriddenBy: string | null;
  readonly eligibilitySnapshot: string;
  readonly selectedBy: string | null;
  readonly removedBy: string | null;
  readonly removedAt: Date | null;
  readonly recordVersion: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** A resolved selection write (insert-or-reactivate an active selection). */
export interface SelectionWrite {
  readonly id: string;
  readonly squadId: string;
  readonly teamId: string;
  readonly membershipId: string;
  readonly selectionRole: SelectionRole;
  readonly reason: string | null;
  readonly eligibilityOverridden: boolean;
  readonly overrideReason: string | null;
  readonly overriddenBy: string | null;
  readonly eligibilitySnapshot: string;
  readonly selectedBy: string;
  readonly now: Date;
}

/** A resolved soft-removal of a selection (kept for history). */
export interface SelectionRemoval {
  readonly squadId: string;
  readonly membershipId: string;
  readonly removedBy: string;
  readonly reason: string | null;
  readonly now: Date;
}

/** An append-only selection history event ready for insertion. */
export interface NewSelectionEvent {
  readonly id: string;
  readonly squadId: string;
  readonly membershipId: string;
  readonly eventType: string;
  readonly selectionRole: SelectionRole | null;
  readonly reason: string | null;
  readonly eligibilitySnapshot: string;
  readonly actorUserId: string | null;
  readonly now: Date;
}

/** Author-supplied selection request content. */
export interface SelectionContent {
  readonly membershipId: string;
  readonly selectionRole: SelectionRole;
  readonly reason: string | null;
}

/** A selection command, with an optional explicit eligibility override. */
export interface SelectPlayerCommand {
  readonly content: SelectionContent;
  readonly override: SelectionOverride | null;
}

/** The explicit human override attached when selecting a flagged player. */
export interface SelectionOverride {
  readonly overrideReason: string;
}

export interface RemoveSelectionCommand {
  readonly membershipId: string;
  readonly reason: string | null;
}

export type SelectionPage = PagedResult<SquadSelection>;

// --- Availability ------------------------------------------------------------

/** The full persisted availability declaration. */
export interface Availability {
  readonly availabilityId: string;
  readonly squadId: string;
  readonly teamId: string;
  readonly membershipId: string;
  readonly availability: AvailabilityStatus;
  readonly reason: string | null;
  readonly source: AvailabilitySource;
  readonly declaredBy: string | null;
  readonly recordVersion: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** A resolved availability upsert (one declaration per member per squad). */
export interface AvailabilityUpsert {
  readonly id: string;
  readonly squadId: string;
  readonly teamId: string;
  readonly membershipId: string;
  readonly availability: AvailabilityStatus;
  readonly reason: string | null;
  readonly source: AvailabilitySource;
  readonly declaredBy: string;
  readonly now: Date;
}

export interface DeclareAvailabilityCommand {
  readonly availability: AvailabilityStatus;
  readonly reason: string | null;
}

export type AvailabilityPage = PagedResult<Availability>;

// --- Eligibility signals (pure domain) ---------------------------------------

/**
 * The raw, per-candidate inputs the eligibility policy consumes. Attendance is a
 * numerator/denominator pair (never a pre-averaged percentage) so the policy owns
 * the null-not-zero decision. `injuredSessions` and the availability declaration
 * are surfaced only as classifications, never as medical detail.
 */
export interface EligibilityInputs {
  readonly membershipId: string;
  readonly fullName: string;
  readonly status: CandidateStatus;
  readonly registeredInSeason: boolean;
  readonly gender: string | null;
  readonly jerseyNumber: number | null;
  readonly attendedSessions: number;
  readonly eligibleSessions: number;
  readonly injuredSessions: number;
  readonly availability: AvailabilityStatus | null;
  readonly selected: boolean;
  readonly selectionOverridden: boolean;
}

/** One explainable eligibility signal outcome for a candidate. */
export interface EligibilitySignal {
  readonly code: SignalCode;
  readonly status: SignalStatus;
}

/** A candidate's full eligibility evaluation under a named policy version. */
export interface MemberEligibility {
  readonly membershipId: string;
  readonly fullName: string;
  readonly jerseyNumber: number | null;
  readonly attendancePct: number | null;
  readonly availability: AvailabilityStatus | null;
  readonly selected: boolean;
  readonly signals: readonly EligibilitySignal[];
  readonly overall: SignalStatus;
  readonly flagged: boolean;
}

/** Advisory gender-ratio balance of a set of players. */
export interface GenderRatio {
  readonly men: number;
  readonly women: number;
  readonly mixed: number;
  readonly unknown: number;
  readonly total: number;
  readonly balanced: boolean;
}

/** The full advisory eligibility report for a squad's candidate pool. */
export interface EligibilityReport {
  readonly squadId: string;
  readonly policyVersion: string;
  readonly attendanceThresholdPct: number;
  readonly candidates: readonly MemberEligibility[];
  readonly selectedGenderRatio: GenderRatio;
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
}

// --- Transport inputs --------------------------------------------------------

export interface SquadContentInput {
  readonly name: string;
  readonly seasonId: string;
  readonly competitionId?: string | null;
  readonly attendanceThresholdPct?: number | null;
  readonly selectionDeadline?: string | null;
  readonly notes?: string | null;
}

export interface SelectionContentInput {
  readonly membershipId: string;
  readonly selectionRole?: SelectionRole | null;
  readonly reason?: string | null;
}

/** A raw self-declared gender and the count of selected players declaring it. */
export interface GenderCount {
  readonly gender: string | null;
  readonly count: number;
}
