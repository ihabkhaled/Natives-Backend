import type {
  AttendanceExcuseCategory,
  AttendanceRuleStatus,
  AttendanceSource,
  AttendanceState,
  AttendanceStatus,
  CheckInWindowState,
  SelfCheckInState,
} from './attendance.enums';
import type { PageRequest, PracticeSession } from './practices.types';
import type { RsvpStatus } from './rsvp.enums';

// --- Aggregates (domain view types) ------------------------------------------

/**
 * A session's attendance sheet: the single finalization-lifecycle row per session
 * (one per `session_id`). It owns the OPEN → FINALIZED → CORRECTED state, the
 * finalization actor/instant, and an optimistic `version` guarding finalize /
 * correct races. Individual participant marks hang off it as attendance records.
 */
export interface AttendanceSheet {
  readonly id: string;
  readonly sessionId: string;
  readonly teamId: string;
  readonly seasonId: string | null;
  readonly state: AttendanceState;
  readonly finalizedAt: Date | null;
  readonly finalizedBy: string | null;
  readonly createdBy: string | null;
  readonly updatedBy: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly version: number;
}

/**
 * The single effective attendance record for a member/session. `latenessMinutes`
 * is null when not measured and 0 only when measured on-time (null-not-zero).
 * Optimistic `version` guards concurrent edits and corrections.
 */
export interface AttendanceRecord {
  readonly id: string;
  readonly sheetId: string;
  readonly sessionId: string;
  readonly teamId: string;
  readonly seasonId: string | null;
  readonly membershipId: string;
  readonly userId: string | null;
  readonly status: AttendanceStatus;
  readonly checkInAt: Date | null;
  readonly checkOutAt: Date | null;
  readonly latenessMinutes: number | null;
  readonly excuseCategory: AttendanceExcuseCategory | null;
  readonly note: string | null;
  readonly evidenceRef: string | null;
  readonly source: AttendanceSource;
  readonly recordedBy: string | null;
  readonly recordedAt: Date;
  readonly createdBy: string | null;
  readonly updatedBy: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly version: number;
}

/** One immutable entry in a record's append-only correction/change history. */
export interface AttendanceRevision {
  readonly id: string;
  readonly recordId: string;
  readonly sessionId: string;
  readonly membershipId: string;
  readonly fromStatus: AttendanceStatus | null;
  readonly toStatus: AttendanceStatus;
  readonly latenessMinutes: number | null;
  readonly excuseCategory: AttendanceExcuseCategory | null;
  readonly source: AttendanceSource;
  readonly isCorrection: boolean;
  readonly correctionReason: string | null;
  readonly actorUserId: string | null;
  readonly occurredAt: Date;
}

/**
 * A versioned attendance scoring rule (weights + penalties + denominator policy).
 * Legacy weights are seeded as a candidate; a displayed rate/points contribution is
 * always a projection from source records against a NAMED version, never a stored
 * editable total.
 */
export interface AttendanceScoringRule {
  readonly code: string;
  readonly status: AttendanceRuleStatus;
  readonly weights: Readonly<Record<string, number>>;
  readonly defaultWeight: number;
  readonly latePenalty: number;
  readonly absentPenalty: number;
  readonly excusedExcluded: boolean;
}

/** A minimal reference to a membership resolved for an attendance write. */
export interface MembershipRef {
  readonly id: string;
  readonly userId: string | null;
}

// --- Scoring inputs (pure domain projection) ---------------------------------

/** One aggregated participation fact: a status count within a session type. */
export interface ParticipationFact {
  readonly status: AttendanceStatus;
  readonly sessionType: string;
  readonly count: number;
}

/**
 * Raw per-member participation INPUTS projected from finalized attendance facts
 * against a cited rule version. Never a stored total. `attendanceRate` and
 * `pointsContribution` are null when there is not enough data (no eligible /
 * scorable sessions) — distinct from a measured zero.
 */
export interface ParticipationInputs {
  readonly ruleVersion: string;
  readonly ruleStatus: AttendanceRuleStatus;
  readonly eligibleSessions: number;
  readonly attended: number;
  readonly onTime: number;
  readonly late: number;
  readonly excused: number;
  readonly injured: number;
  readonly absent: number;
  readonly remoteApproved: number;
  readonly otherApproved: number;
  readonly excludedSessions: number;
  readonly denominator: number;
  readonly attendanceRate: number | null;
  readonly weightedPresentPoints: number;
  readonly latePenaltyPoints: number;
  readonly absentPenaltyPoints: number;
  readonly pointsContribution: number | null;
}

// --- Application command / context models -------------------------------------

/** The mark fields for one participant, independent of which participant. */
export interface AttendanceMarkFields {
  readonly status: AttendanceStatus;
  readonly checkInAt: Date | null;
  readonly checkOutAt: Date | null;
  readonly latenessMinutes: number | null;
  readonly excuseCategory: AttendanceExcuseCategory | null;
  readonly note: string | null;
  readonly evidenceRef: string | null;
  readonly expectedVersion: number | null;
}

/** One participant mark inside a coach single/bulk record command. */
export interface AttendanceMarkInput extends AttendanceMarkFields {
  readonly membershipId: string;
}

/** A coach/admin command to mark one or more participants (atomic bulk). */
export interface RecordAttendanceCommand {
  readonly marks: readonly AttendanceMarkInput[];
}

/** A member's self check-in command (status is derived from the clock). */
export interface SelfCheckInCommand {
  readonly note: string | null;
}

/** The status + measured lateness a self check-in derives from the clock. */
export interface SelfCheckInDerivation {
  readonly status: AttendanceStatus;
  readonly latenessMinutes: number | null;
}

/** The resolved self check-in window for one session at one instant (pure). */
export interface CheckInWindow {
  readonly opensAt: Date;
  readonly closesAt: Date;
  readonly state: CheckInWindowState;
}

/**
 * The self check-in eligibility block on the own-attendance read: the window
 * bounds plus the full state (window state, or `locked`/`recorded`) so the client
 * renders "opens at / closed / recorded / locked" without owning the rule.
 */
export interface SelfCheckInEligibility {
  readonly state: SelfCheckInState;
  readonly opensAt: Date;
  readonly closesAt: Date;
}

/** A privileged correction of one participant's finalized attendance. */
export interface CorrectAttendanceCommand {
  readonly status: AttendanceStatus;
  readonly checkInAt: Date | null;
  readonly checkOutAt: Date | null;
  readonly latenessMinutes: number | null;
  readonly excuseCategory: AttendanceExcuseCategory | null;
  readonly note: string | null;
  readonly evidenceRef: string | null;
  readonly correctionReason: string;
  readonly expectedVersion: number | null;
}

/** A finalize command (optimistic on the sheet version). */
export interface FinalizeAttendanceCommand {
  readonly expectedVersion: number;
}

/** Everything the recorder needs to persist one effective attendance record. */
export interface AttendanceWriteContext {
  readonly sheetId: string;
  readonly session: PracticeSession;
  readonly membershipId: string;
  readonly userId: string | null;
  readonly status: AttendanceStatus;
  readonly checkInAt: Date | null;
  readonly checkOutAt: Date | null;
  readonly latenessMinutes: number | null;
  readonly excuseCategory: AttendanceExcuseCategory | null;
  readonly note: string | null;
  readonly evidenceRef: string | null;
  readonly source: AttendanceSource;
  readonly isCorrection: boolean;
  readonly correctionReason: string | null;
  readonly expectedVersion: number | null;
  readonly actorUserId: string | null;
  readonly now: Date;
}

// --- Query models -------------------------------------------------------------

export interface AttendanceListQuery {
  readonly limit?: number;
  readonly offset?: number;
}

export interface ParticipationQuery {
  readonly seasonId?: string;
}

/**
 * One roster row: an active member and their attendance (null when unmarked).
 * `displayName` resolves through the member-profile → user fallback chain (null
 * when neither exists) and `rsvpStatus` carries the member's RSVP answer for the
 * session (null when no RSVP row exists) — additive coach-capture context.
 */
export interface RosterEntry {
  readonly membershipId: string;
  readonly userId: string | null;
  readonly displayName: string | null;
  readonly rsvpStatus: RsvpStatus | null;
  readonly status: AttendanceStatus | null;
  readonly checkInAt: Date | null;
  readonly latenessMinutes: number | null;
  readonly excuseCategory: AttendanceExcuseCategory | null;
  readonly source: AttendanceSource | null;
  readonly version: number | null;
}

/** The roster + sheet state returned by the attendance list read. */
export interface AttendanceSheetView {
  readonly sessionId: string;
  readonly state: AttendanceState;
  readonly finalizedAt: Date | null;
  /** The sheet's optimistic version (for finalize), or null before any record. */
  readonly version: number | null;
  readonly items: readonly RosterEntry[];
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
}

/** The finalize/correct sheet status returned to the transport layer. */
export interface AttendanceSheetStatusView {
  readonly sessionId: string;
  readonly state: AttendanceState;
  readonly finalizedAt: Date | null;
  readonly recordCount: number;
  readonly version: number;
}

/** Outcome of a bulk record run (atomic — either all rows applied or none). */
export interface BulkRecordResult {
  readonly items: readonly AttendanceView[];
  readonly recorded: number;
}

/**
 * A member's own attendance for a session (explicit "not recorded" when absent).
 * `selfCheckIn` is populated only by the own-attendance read (the eligibility
 * block); every other producer of this view carries null there.
 */
export interface AttendanceView {
  readonly sessionId: string;
  readonly membershipId: string;
  readonly status: AttendanceStatus | null;
  readonly checkInAt: Date | null;
  readonly checkOutAt: Date | null;
  readonly latenessMinutes: number | null;
  readonly excuseCategory: AttendanceExcuseCategory | null;
  readonly source: AttendanceSource | null;
  readonly recordedAt: Date | null;
  readonly version: number | null;
  readonly selfCheckIn: SelfCheckInEligibility | null;
}

export interface ListAttendanceRevisionsResult {
  readonly items: readonly AttendanceRevision[];
}

/**
 * One row of a member's own attendance history: a past (started, not cancelled)
 * session LEFT-JOINed with the caller's record. `status: null` means "not
 * recorded" (null-not-zero) and `sheetState` lets the client say "not finalized
 * yet" (null before any sheet exists).
 */
export interface SelfHistoryEntry {
  readonly sessionId: string;
  readonly startsAt: Date;
  readonly endsAt: Date;
  readonly sessionType: string;
  readonly status: AttendanceStatus | null;
  readonly latenessMinutes: number | null;
  readonly excuseCategory: AttendanceExcuseCategory | null;
  readonly source: AttendanceSource | null;
  readonly recordedAt: Date | null;
  readonly sheetState: AttendanceState | null;
}

/** The paginated own-attendance history envelope (newest first). */
export interface SelfHistoryView {
  readonly items: readonly SelfHistoryEntry[];
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
}

/** Raw self-history query values (as received from the query DTO). */
export interface SelfHistoryQueryInput extends AttendanceListQuery {
  readonly seasonId?: string;
}

/** The resolved season filter + clamped page for a self-history read. */
export interface SelfHistoryRequest {
  readonly seasonId: string | null;
  readonly page: PageRequest;
}

/** The fully-resolved scan context the self-history SQL binds against. */
export interface SelfHistoryScan {
  readonly teamId: string;
  readonly membershipId: string;
  readonly seasonId: string | null;
  readonly now: Date;
  readonly page: PageRequest;
}

/**
 * Participation inputs shaped for the API: the raw computed inputs plus a display
 * percentage rounded only here at presentation (never in the domain computation).
 */
export interface ParticipationView extends ParticipationInputs {
  readonly membershipId: string;
  readonly seasonId: string | null;
  readonly attendanceRatePercent: number | null;
}

// --- Persistence write models ------------------------------------------------

export interface NewAttendanceSheet {
  readonly id: string;
  readonly sessionId: string;
  readonly teamId: string;
  readonly seasonId: string | null;
  readonly createdBy: string | null;
  readonly now: Date;
}

export interface SheetFinalize {
  readonly id: string;
  readonly finalizedBy: string | null;
  readonly expectedVersion: number;
  readonly now: Date;
}

export interface SheetCorrection {
  readonly id: string;
  readonly updatedBy: string | null;
  readonly now: Date;
}

export interface NewAttendanceRecord {
  readonly id: string;
  readonly sheetId: string;
  readonly sessionId: string;
  readonly teamId: string;
  readonly seasonId: string | null;
  readonly membershipId: string;
  readonly userId: string | null;
  readonly status: AttendanceStatus;
  readonly checkInAt: Date | null;
  readonly checkOutAt: Date | null;
  readonly latenessMinutes: number | null;
  readonly excuseCategory: AttendanceExcuseCategory | null;
  readonly note: string | null;
  readonly evidenceRef: string | null;
  readonly source: AttendanceSource;
  readonly recordedBy: string | null;
  readonly recordedAt: Date;
  readonly createdBy: string | null;
  readonly now: Date;
}

export interface AttendanceRecordUpdate {
  readonly id: string;
  readonly status: AttendanceStatus;
  readonly checkInAt: Date | null;
  readonly checkOutAt: Date | null;
  readonly latenessMinutes: number | null;
  readonly excuseCategory: AttendanceExcuseCategory | null;
  readonly note: string | null;
  readonly evidenceRef: string | null;
  readonly source: AttendanceSource;
  readonly recordedBy: string | null;
  readonly recordedAt: Date;
  readonly updatedBy: string | null;
  readonly expectedVersion: number;
  readonly now: Date;
}

export interface NewAttendanceRevision {
  readonly id: string;
  readonly recordId: string;
  readonly sessionId: string;
  readonly membershipId: string;
  readonly fromStatus: AttendanceStatus | null;
  readonly toStatus: AttendanceStatus;
  readonly latenessMinutes: number | null;
  readonly excuseCategory: AttendanceExcuseCategory | null;
  readonly source: AttendanceSource;
  readonly isCorrection: boolean;
  readonly correctionReason: string | null;
  readonly actorUserId: string | null;
  readonly now: Date;
}
