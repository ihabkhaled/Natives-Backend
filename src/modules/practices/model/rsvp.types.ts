import type { PracticeSession } from './practices.types';
import type {
  RsvpNoteVisibility,
  RsvpReasonCategory,
  RsvpSource,
  RsvpStatus,
} from './rsvp.enums';

// --- Aggregates (domain view types) ------------------------------------------

/**
 * The single effective RSVP for a member/session. Intention only — never an
 * attendance record. `waitlisted` is true when a `going` answer exceeded capacity;
 * optimistic `version` guards concurrent edits from multiple devices.
 */
export interface PracticeRsvp {
  readonly id: string;
  readonly sessionId: string;
  readonly teamId: string;
  readonly seasonId: string | null;
  readonly membershipId: string;
  readonly userId: string | null;
  readonly status: RsvpStatus;
  readonly reasonCategory: RsvpReasonCategory | null;
  readonly note: string | null;
  readonly noteVisibility: RsvpNoteVisibility;
  readonly source: RsvpSource;
  readonly waitlisted: boolean;
  readonly respondedAt: Date;
  readonly createdBy: string | null;
  readonly updatedBy: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly version: number;
}

/** One immutable entry in an RSVP's append-only revision history. */
export interface RsvpRevision {
  readonly id: string;
  readonly rsvpId: string;
  readonly sessionId: string;
  readonly membershipId: string;
  readonly fromStatus: RsvpStatus | null;
  readonly toStatus: RsvpStatus;
  readonly reasonCategory: RsvpReasonCategory | null;
  readonly note: string | null;
  readonly waitlisted: boolean;
  readonly source: RsvpSource;
  readonly isOverride: boolean;
  readonly overrideReason: string | null;
  readonly actorUserId: string | null;
  readonly occurredAt: Date;
}

/** A minimal reference to a membership resolved for an RSVP write. */
export interface MembershipRef {
  readonly id: string;
  readonly userId: string | null;
}

/** The pure slot state used to decide waitlist promotions. */
export interface RsvpSlotState {
  readonly status: RsvpStatus;
  readonly waitlisted: boolean;
}

// --- Response projections -----------------------------------------------------

/**
 * A member's own RSVP as returned by the API. `version` (and the response
 * metadata) are null for a synthesized `no_response` view when the member has not
 * answered yet — modelling absence explicitly rather than raising an error.
 */
export interface RsvpView {
  readonly sessionId: string;
  readonly membershipId: string;
  readonly status: RsvpStatus;
  readonly reasonCategory: RsvpReasonCategory | null;
  readonly note: string | null;
  readonly noteVisibility: RsvpNoteVisibility | null;
  readonly source: RsvpSource | null;
  readonly waitlisted: boolean;
  readonly respondedAt: Date | null;
  readonly version: number | null;
}

/** A privacy-safe participant row for the team-readable list (no note/reason). */
export interface RsvpParticipant {
  readonly membershipId: string;
  readonly status: RsvpStatus;
  readonly waitlisted: boolean;
  readonly source: RsvpSource;
  readonly respondedAt: Date;
}

/**
 * Privacy-safe planning aggregate for a session. Counts are projections from the
 * RSVP rows (never a stored editable total). `spotsRemaining` is null when the
 * session is uncapped (null-not-zero: uncapped is not "zero left").
 */
export interface RsvpSummary {
  readonly sessionId: string;
  readonly capacity: number | null;
  readonly going: number;
  readonly waitlisted: number;
  readonly notGoing: number;
  readonly maybe: number;
  readonly noResponse: number;
  readonly spotsRemaining: number | null;
}

// --- Application command / context models ------------------------------------

export interface SetRsvpCommand {
  readonly status: RsvpStatus;
  readonly reasonCategory: RsvpReasonCategory | null;
  readonly note: string | null;
  readonly noteVisibility: RsvpNoteVisibility | null;
  readonly expectedVersion: number | null;
}

export interface OverrideRsvpCommand {
  readonly status: RsvpStatus;
  readonly reasonCategory: RsvpReasonCategory | null;
  readonly note: string | null;
  readonly noteVisibility: RsvpNoteVisibility | null;
  readonly overrideReason: string;
  readonly expectedVersion: number | null;
}

/** Everything the RSVP recorder needs to persist one effective response. */
export interface RsvpWriteContext {
  readonly session: PracticeSession;
  readonly membershipId: string;
  readonly userId: string | null;
  readonly status: RsvpStatus;
  readonly reasonCategory: RsvpReasonCategory | null;
  readonly note: string | null;
  readonly noteVisibility: RsvpNoteVisibility;
  readonly source: RsvpSource;
  readonly isOverride: boolean;
  readonly overrideReason: string | null;
  readonly expectedVersion: number | null;
  readonly actorUserId: string | null;
  readonly now: Date;
}

/** Outcome of a recorded response: the row plus any waitlist promotion it caused. */
export interface RsvpWriteOutcome {
  readonly rsvp: PracticeRsvp;
  readonly promotedMembershipId: string | null;
}

// --- Query models ------------------------------------------------------------

export interface RsvpListQuery {
  readonly status?: RsvpStatus;
  readonly limit?: number;
  readonly offset?: number;
}

export interface RsvpListFilter {
  readonly status: RsvpStatus | null;
  readonly limit: number;
  readonly offset: number;
}

export interface ListRsvpsResult {
  readonly items: readonly RsvpParticipant[];
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
}

export interface ListRsvpRevisionsResult {
  readonly items: readonly RsvpRevision[];
}

// --- Persistence write models ------------------------------------------------

export interface NewRsvp {
  readonly id: string;
  readonly sessionId: string;
  readonly teamId: string;
  readonly seasonId: string | null;
  readonly membershipId: string;
  readonly userId: string | null;
  readonly status: RsvpStatus;
  readonly reasonCategory: RsvpReasonCategory | null;
  readonly note: string | null;
  readonly noteVisibility: RsvpNoteVisibility;
  readonly source: RsvpSource;
  readonly waitlisted: boolean;
  readonly respondedAt: Date;
  readonly createdBy: string | null;
  readonly now: Date;
}

export interface RsvpUpdate {
  readonly id: string;
  readonly status: RsvpStatus;
  readonly reasonCategory: RsvpReasonCategory | null;
  readonly note: string | null;
  readonly noteVisibility: RsvpNoteVisibility;
  readonly source: RsvpSource;
  readonly waitlisted: boolean;
  readonly respondedAt: Date;
  readonly updatedBy: string | null;
  readonly expectedVersion: number;
  readonly now: Date;
}

export interface RsvpPromotion {
  readonly id: string;
  readonly updatedBy: string | null;
  readonly expectedVersion: number;
  readonly now: Date;
}

export interface NewRsvpRevision {
  readonly id: string;
  readonly rsvpId: string;
  readonly sessionId: string;
  readonly membershipId: string;
  readonly fromStatus: RsvpStatus | null;
  readonly toStatus: RsvpStatus;
  readonly reasonCategory: RsvpReasonCategory | null;
  readonly note: string | null;
  readonly waitlisted: boolean;
  readonly source: RsvpSource;
  readonly isOverride: boolean;
  readonly overrideReason: string | null;
  readonly actorUserId: string | null;
  readonly now: Date;
}

/** The projected counts a summary query returns (before capacity derivation). */
export interface RsvpCounts {
  readonly going: number;
  readonly waitlisted: number;
  readonly notGoing: number;
  readonly maybe: number;
  readonly noResponse: number;
}
