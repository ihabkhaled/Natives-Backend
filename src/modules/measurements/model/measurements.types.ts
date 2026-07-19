import type {
  MeasurementDimension,
  MeasurementDirection,
  MeasurementDiscipline,
  MeasurementUnit,
  ProtocolStatus,
  ResultPolicy,
  SessionStatus,
  SessionTransition,
} from './measurements.enums';

// --- Units -------------------------------------------------------------------

/** The dimension a unit belongs to and its multiplier to the canonical unit. */
export interface UnitMetadata {
  readonly dimension: MeasurementDimension;
  readonly factor: number;
}

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

// --- Protocol ----------------------------------------------------------------

/** Author-supplied content of a measurement protocol (create command). */
export interface ProtocolContent {
  readonly protocolKey: string;
  readonly name: string;
  readonly description: string | null;
  readonly seasonId: string | null;
  readonly discipline: MeasurementDiscipline;
  readonly unit: MeasurementUnit;
  readonly direction: MeasurementDirection;
  readonly resultPolicy: ResultPolicy;
  readonly instructions: string | null;
  readonly safetyNotes: string | null;
  readonly minValue: number | null;
  readonly maxValue: number | null;
}

/** Loosely-typed protocol input the DTO structurally satisfies. */
export interface ProtocolContentInput {
  readonly protocolKey: string;
  readonly name: string;
  readonly description?: string | null;
  readonly seasonId?: string | null;
  readonly discipline: MeasurementDiscipline;
  readonly unit: MeasurementUnit;
  readonly direction: MeasurementDirection;
  readonly resultPolicy: ResultPolicy;
  readonly instructions?: string | null;
  readonly safetyNotes?: string | null;
  readonly minValue?: number | null;
  readonly maxValue?: number | null;
}

/** A fully-resolved new protocol row ready for insertion. */
export interface NewProtocol {
  readonly id: string;
  readonly teamId: string;
  readonly content: ProtocolContent;
  readonly createdBy: string;
  readonly now: Date;
}

/** The full persisted measurement-protocol aggregate. */
export interface MeasurementProtocol {
  readonly id: string;
  readonly teamId: string | null;
  readonly seasonId: string | null;
  readonly protocolKey: string;
  readonly name: string;
  readonly description: string | null;
  readonly discipline: MeasurementDiscipline;
  readonly unit: MeasurementUnit;
  readonly direction: MeasurementDirection;
  readonly resultPolicy: ResultPolicy;
  readonly instructions: string | null;
  readonly safetyNotes: string | null;
  readonly minValue: number | null;
  readonly maxValue: number | null;
  readonly status: ProtocolStatus;
  readonly recordVersion: number;
  readonly createdBy: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateProtocolCommand {
  readonly content: ProtocolContent;
}

// --- Session -----------------------------------------------------------------

/** Author-supplied content of a measurement session (create command). */
export interface SessionContent {
  readonly title: string;
  readonly seasonId: string | null;
  readonly scheduledAt: string;
  readonly location: string | null;
  readonly conditions: string | null;
  readonly notes: string | null;
}

/** Loosely-typed session input the DTO structurally satisfies. */
export interface SessionContentInput {
  readonly title: string;
  readonly seasonId?: string | null;
  readonly scheduledAt: string;
  readonly location?: string | null;
  readonly conditions?: string | null;
  readonly notes?: string | null;
}

/** A fully-resolved new session row ready for insertion. */
export interface NewSession {
  readonly id: string;
  readonly teamId: string;
  readonly content: SessionContent;
  readonly createdBy: string;
  readonly now: Date;
}

/** The full persisted measurement-session aggregate. */
export interface MeasurementSession {
  readonly id: string;
  readonly teamId: string;
  readonly seasonId: string | null;
  readonly title: string;
  readonly status: SessionStatus;
  readonly scheduledAt: Date;
  readonly conductedAt: Date | null;
  readonly location: string | null;
  readonly conditions: string | null;
  readonly notes: string | null;
  readonly recordVersion: number;
  readonly createdBy: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateSessionCommand {
  readonly content: SessionContent;
}

export interface TransitionSessionCommand {
  readonly transition: SessionTransition;
  readonly expectedRecordVersion: number;
}

/** An optimistic-version-guarded lifecycle status change of a session. */
export interface SessionStatusChange {
  readonly id: string;
  readonly teamId: string;
  readonly expectedRecordVersion: number;
  readonly toStatus: SessionStatus;
  readonly conductedAt: Date | null;
  readonly now: Date;
}

// --- Attempts ----------------------------------------------------------------

/** One raw attempt as supplied by the recorder (before number assignment). */
export interface AttemptInput {
  readonly value: number | null;
  readonly unit: MeasurementUnit;
  readonly valid: boolean;
  readonly disqualified: boolean;
  readonly dqReason: string | null;
  readonly notes: string | null;
}

/** Loosely-typed attempt input the DTO structurally satisfies. */
export interface RawAttemptInput {
  readonly value?: number | null;
  readonly unit: MeasurementUnit;
  readonly valid?: boolean;
  readonly disqualified?: boolean;
  readonly dqReason?: string | null;
  readonly notes?: string | null;
}

/** The recorder's full command for one player+protocol within a session. */
export interface RecordMeasurementCommand {
  readonly membershipId: string;
  readonly protocolId: string;
  readonly attempts: readonly AttemptInput[];
}

/** A fully-resolved attempt row ready for insertion (number + canonical set). */
export interface NewAttempt {
  readonly id: string;
  readonly sessionId: string;
  readonly teamId: string;
  readonly membershipId: string;
  readonly protocolId: string;
  readonly attemptNumber: number;
  readonly rawValue: number | null;
  readonly unit: MeasurementUnit;
  readonly canonicalValue: number | null;
  readonly valid: boolean;
  readonly disqualified: boolean;
  readonly dqReason: string | null;
  readonly evaluatorUserId: string;
  readonly notes: string | null;
  readonly now: Date;
}

/** The persisted raw attempt (immutable once recorded). */
export interface MeasurementAttempt {
  readonly id: string;
  readonly sessionId: string;
  readonly teamId: string;
  readonly membershipId: string;
  readonly protocolId: string;
  readonly attemptNumber: number;
  readonly rawValue: number | null;
  readonly unit: MeasurementUnit;
  readonly canonicalValue: number | null;
  readonly valid: boolean;
  readonly disqualified: boolean;
  readonly dqReason: string | null;
  readonly evaluatorUserId: string | null;
  readonly notes: string | null;
  readonly recordedAt: Date;
  readonly createdAt: Date;
}

/** The context a record needs: the target session, protocol, and next number. */
export interface RecordTarget {
  readonly session: MeasurementSession;
  readonly protocol: MeasurementProtocol;
  readonly baseAttemptNumber: number;
}

// --- Pure result selection ---------------------------------------------------

/**
 * The minimal attempt shape the selection policy consumes: the canonical value
 * (null when missing/not-attempted — never zero), the attempt ordinal, and the
 * validity flags that exclude an attempt from selection.
 */
export interface SelectableAttempt {
  readonly attemptNumber: number;
  readonly value: number | null;
  readonly valid: boolean;
  readonly disqualified: boolean;
}

/**
 * The explained derived result for a protocol. `selected` is null (not zero) when
 * no valid attempt exists. `best`, `average`, and `latest` are all carried so the
 * chosen policy is transparent and a chart can show provenance.
 */
export interface ResultSelection {
  readonly method: ResultPolicy;
  readonly direction: MeasurementDirection;
  readonly selected: number | null;
  readonly best: number | null;
  readonly average: number | null;
  readonly latest: number | null;
  readonly consideredCount: number;
  readonly excludedCount: number;
}

// --- History -----------------------------------------------------------------

/** One protocol's attempt history for a membership plus its derived result. */
export interface ProtocolHistoryEntry {
  readonly protocol: MeasurementProtocol;
  readonly attempts: readonly MeasurementAttempt[];
  readonly result: ResultSelection;
}

/** A membership's full objective-measurement history across protocols. */
export interface MeasurementHistory {
  readonly membershipId: string;
  readonly entries: readonly ProtocolHistoryEntry[];
}

/** The recorded outcome returned to the recorder after a successful write. */
export interface RecordedMeasurement {
  readonly sessionId: string;
  readonly membershipId: string;
  readonly protocol: MeasurementProtocol;
  readonly attempts: readonly MeasurementAttempt[];
  readonly result: ResultSelection;
}

// --- Read envelopes ----------------------------------------------------------

export type ProtocolPage = PagedResult<MeasurementProtocol>;
export type SessionPage = PagedResult<MeasurementSession>;

/** A session with its full attempt list (detail read). */
export interface SessionDetail {
  readonly session: MeasurementSession;
  readonly attempts: readonly MeasurementAttempt[];
}
