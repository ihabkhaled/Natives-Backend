import type {
  RecurrenceFrequency,
  ScheduleStatus,
  SessionStatus,
  SessionVisibility,
} from './practices.enums';

// --- Aggregates (domain view types returned to the transport layer) ----------

/**
 * A recurring (or one-off) practice template. It is NOT a session: it captures
 * the cadence, defaults, and bounded generation horizon from which stable session
 * instances are produced. Recurrence is interpreted in the schedule's timezone
 * (Africa/Cairo by default) and generation persists unambiguous UTC instants.
 */
export interface PracticeSchedule {
  readonly id: string;
  readonly teamId: string;
  readonly seasonId: string | null;
  readonly name: string;
  readonly sessionType: string;
  readonly timezone: string;
  readonly frequency: RecurrenceFrequency;
  readonly intervalWeeks: number;
  /** Weekdays the practice repeats on, 0=Sunday … 6=Saturday. Empty for one-off. */
  readonly weekdays: readonly number[];
  /** Local wall-clock start, `HH:MM` in the schedule timezone. */
  readonly startTimeLocal: string;
  readonly durationMinutes: number;
  readonly meetOffsetMinutes: number | null;
  readonly rsvpCutoffMinutes: number | null;
  readonly defaultVenueId: string | null;
  readonly defaultField: string | null;
  readonly defaultCapacity: number | null;
  readonly visibility: SessionVisibility;
  readonly organizerUserId: string | null;
  readonly notes: string | null;
  /** Inclusive local calendar bounds of the generation horizon (`YYYY-MM-DD`). */
  readonly generationStart: string;
  readonly generationUntil: string;
  /** Excluded local calendar dates (`YYYY-MM-DD`) — recurrence exceptions. */
  readonly exceptions: readonly string[];
  readonly status: ScheduleStatus;
  readonly createdBy: string | null;
  readonly updatedBy: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly version: number;
}

/**
 * A concrete practice occurrence. Times are stored as UTC instants; the source
 * timezone is retained for presentation. A generated session carries its owning
 * schedule id and local occurrence date (the idempotency key); a one-off session
 * has neither.
 */
export interface PracticeSession {
  readonly id: string;
  readonly teamId: string;
  readonly seasonId: string | null;
  readonly scheduleId: string | null;
  readonly occurrenceDate: string | null;
  readonly sessionType: string;
  readonly timezone: string;
  readonly venueId: string | null;
  readonly field: string | null;
  readonly capacity: number | null;
  readonly meetAt: Date | null;
  readonly startsAt: Date;
  readonly endsAt: Date;
  readonly rsvpCutoffAt: Date | null;
  readonly visibility: SessionVisibility;
  readonly organizerUserId: string | null;
  readonly notes: string | null;
  readonly status: SessionStatus;
  readonly cancellationReason: string | null;
  readonly createdBy: string | null;
  readonly updatedBy: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly version: number;
}

/** One immutable entry in a session's append-only status history. */
export interface SessionStatusEvent {
  readonly id: string;
  readonly sessionId: string;
  readonly fromStatus: SessionStatus | null;
  readonly toStatus: SessionStatus;
  readonly reason: string | null;
  readonly actorUserId: string | null;
  readonly occurredAt: Date;
}

// --- Recurrence (pure domain input) ------------------------------------------

/** The bounded, timezone-agnostic recurrence definition the generator expands. */
export interface RecurrenceRule {
  readonly frequency: RecurrenceFrequency;
  readonly intervalWeeks: number;
  readonly weekdays: readonly number[];
  readonly generationStart: string;
  readonly generationUntil: string;
  readonly exceptions: readonly string[];
}

/** The resolved UTC window for a single occurrence. */
export interface SessionWindow {
  readonly meetAt: Date | null;
  readonly startsAt: Date;
  readonly endsAt: Date;
  readonly rsvpCutoffAt: Date | null;
}

// --- Application command models (built by the controller from DTOs) ----------

export interface CreateScheduleCommand {
  readonly seasonId: string | null;
  readonly name: string;
  readonly sessionType: string;
  readonly timezone: string | null;
  readonly frequency: RecurrenceFrequency;
  readonly intervalWeeks: number | null;
  readonly weekdays: readonly number[];
  readonly startTimeLocal: string;
  readonly durationMinutes: number;
  readonly meetOffsetMinutes: number | null;
  readonly rsvpCutoffMinutes: number | null;
  readonly defaultVenueId: string | null;
  readonly defaultField: string | null;
  readonly defaultCapacity: number | null;
  readonly visibility: SessionVisibility | null;
  readonly organizerUserId: string | null;
  readonly notes: string | null;
  readonly generationStart: string;
  readonly generationUntil: string;
  readonly exceptions: readonly string[];
}

export interface UpdateScheduleCommand extends CreateScheduleCommand {
  readonly status: ScheduleStatus;
  readonly expectedVersion: number;
}

export interface CreateSessionCommand {
  readonly seasonId: string | null;
  readonly sessionType: string;
  readonly timezone: string | null;
  readonly venueId: string | null;
  readonly field: string | null;
  readonly capacity: number | null;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly meetAt: string | null;
  readonly rsvpCutoffAt: string | null;
  readonly visibility: SessionVisibility | null;
  readonly organizerUserId: string | null;
  readonly notes: string | null;
}

export interface UpdateSessionCommand {
  readonly venueId: string | null;
  readonly field: string | null;
  readonly capacity: number | null;
  readonly notes: string | null;
  readonly visibility: SessionVisibility;
  readonly expectedVersion: number;
}

export interface RescheduleSessionCommand {
  readonly startsAt: string;
  readonly endsAt: string;
  readonly meetAt: string | null;
  readonly rsvpCutoffAt: string | null;
  readonly venueId: string | null;
  readonly field: string | null;
  readonly reason: string | null;
  readonly expectedVersion: number;
}

export interface SessionStatusCommand {
  readonly reason: string | null;
  readonly expectedVersion: number;
}

export interface SessionListFilter {
  readonly from: Date | null;
  readonly to: Date | null;
  readonly status: SessionStatus | null;
  readonly sessionType: string | null;
  readonly seasonId: string | null;
  readonly limit: number;
  readonly offset: number;
}

/** A composed, parameterized SQL predicate + its ordered bind values. */
export interface SessionFilterClause {
  readonly clause: string;
  readonly params: readonly unknown[];
}

/** Raw calendar/list query values (as received from the query DTO). */
export interface SessionListQuery {
  readonly from?: string;
  readonly to?: string;
  readonly status?: SessionStatus;
  readonly sessionType?: string;
  readonly seasonId?: string;
  readonly limit?: number;
  readonly offset?: number;
}

// --- Persistence write models ------------------------------------------------

export interface NewSchedule {
  readonly id: string;
  readonly teamId: string;
  readonly seasonId: string | null;
  readonly name: string;
  readonly sessionType: string;
  readonly timezone: string;
  readonly frequency: RecurrenceFrequency;
  readonly intervalWeeks: number;
  readonly weekdays: readonly number[];
  readonly startTimeLocal: string;
  readonly durationMinutes: number;
  readonly meetOffsetMinutes: number | null;
  readonly rsvpCutoffMinutes: number | null;
  readonly defaultVenueId: string | null;
  readonly defaultField: string | null;
  readonly defaultCapacity: number | null;
  readonly visibility: SessionVisibility;
  readonly organizerUserId: string | null;
  readonly notes: string | null;
  readonly generationStart: string;
  readonly generationUntil: string;
  readonly exceptions: readonly string[];
  readonly createdBy: string | null;
  readonly now: Date;
}

export interface ScheduleUpdate {
  readonly id: string;
  readonly teamId: string;
  readonly seasonId: string | null;
  readonly name: string;
  readonly sessionType: string;
  readonly timezone: string;
  readonly frequency: RecurrenceFrequency;
  readonly intervalWeeks: number;
  readonly weekdays: readonly number[];
  readonly startTimeLocal: string;
  readonly durationMinutes: number;
  readonly meetOffsetMinutes: number | null;
  readonly rsvpCutoffMinutes: number | null;
  readonly defaultVenueId: string | null;
  readonly defaultField: string | null;
  readonly defaultCapacity: number | null;
  readonly visibility: SessionVisibility;
  readonly organizerUserId: string | null;
  readonly notes: string | null;
  readonly generationStart: string;
  readonly generationUntil: string;
  readonly exceptions: readonly string[];
  readonly status: ScheduleStatus;
  readonly updatedBy: string | null;
  readonly expectedVersion: number;
  readonly now: Date;
}

export interface NewSession {
  readonly id: string;
  readonly teamId: string;
  readonly seasonId: string | null;
  readonly scheduleId: string | null;
  readonly occurrenceDate: string | null;
  readonly sessionType: string;
  readonly timezone: string;
  readonly venueId: string | null;
  readonly field: string | null;
  readonly capacity: number | null;
  readonly meetAt: Date | null;
  readonly startsAt: Date;
  readonly endsAt: Date;
  readonly rsvpCutoffAt: Date | null;
  readonly visibility: SessionVisibility;
  readonly organizerUserId: string | null;
  readonly notes: string | null;
  readonly status: SessionStatus;
  readonly createdBy: string | null;
  readonly now: Date;
}

export interface SessionDetailsUpdate {
  readonly id: string;
  readonly teamId: string;
  readonly venueId: string | null;
  readonly field: string | null;
  readonly capacity: number | null;
  readonly notes: string | null;
  readonly visibility: SessionVisibility;
  readonly updatedBy: string | null;
  readonly expectedVersion: number;
  readonly now: Date;
}

export interface SessionRescheduleWrite {
  readonly id: string;
  readonly teamId: string;
  readonly status: SessionStatus;
  readonly meetAt: Date | null;
  readonly startsAt: Date;
  readonly endsAt: Date;
  readonly rsvpCutoffAt: Date | null;
  readonly venueId: string | null;
  readonly field: string | null;
  readonly updatedBy: string | null;
  readonly expectedVersion: number;
  readonly now: Date;
}

export interface SessionStatusChange {
  readonly id: string;
  readonly teamId: string;
  readonly status: SessionStatus;
  readonly cancellationReason: string | null;
  readonly updatedBy: string | null;
  readonly expectedVersion: number;
  readonly now: Date;
}

export interface NewStatusEvent {
  readonly id: string;
  readonly sessionId: string;
  readonly fromStatus: SessionStatus | null;
  readonly toStatus: SessionStatus;
  readonly reason: string | null;
  readonly actorUserId: string | null;
  readonly now: Date;
}

/** One occurrence row inserted during idempotent generation. */
export interface GeneratedOccurrence {
  readonly id: string;
  readonly occurrenceDate: string;
  readonly window: SessionWindow;
}

// --- Pagination + results ----------------------------------------------------

export interface PageRequest {
  readonly limit: number;
  readonly offset: number;
}

export interface ListSchedulesResult {
  readonly items: readonly PracticeSchedule[];
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
}

export interface ListSessionsResult {
  readonly items: readonly PracticeSession[];
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
}

/** Outcome of an idempotent generation run over a schedule. */
export interface GenerationResult {
  readonly created: number;
  readonly skipped: number;
  readonly sessions: readonly PracticeSession[];
}

/** A session's append-only status history, oldest-first. */
export interface ListStatusEventsResult {
  readonly items: readonly SessionStatusEvent[];
}
