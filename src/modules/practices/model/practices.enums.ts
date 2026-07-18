/**
 * Enumerations for the practices bounded context (schedules, sessions, and
 * cancellations). Every enum ships a `*_VALUES` array so DTO validation and pure
 * guards reference the canonical set without re-listing literals. Values are the
 * stable strings persisted in the database.
 */

/**
 * Practice-session lifecycle. A session is a stable, concrete occurrence (never
 * the recurring template). Draft sessions are planned but not yet visible;
 * publishing announces them; a reschedule marks a published session as moved; a
 * cancellation is a status change that never deletes RSVP/attendance history;
 * completion locks the session; archival retires it. Corrections to a completed
 * session happen through the audited attendance workflow, not by re-opening it.
 */
export enum SessionStatus {
  Draft = 'draft',
  Published = 'published',
  Rescheduled = 'rescheduled',
  Cancelled = 'cancelled',
  Completed = 'completed',
  Archived = 'archived',
}

export const SESSION_STATUS_VALUES: readonly SessionStatus[] =
  Object.values(SessionStatus);

/**
 * How a recurring schedule repeats. `Weekly` fans out onto chosen weekdays across
 * a bounded horizon; `OneOff` yields a single occurrence on its start date. New
 * cadences are added here without touching generation call sites.
 */
export enum RecurrenceFrequency {
  Weekly = 'weekly',
  OneOff = 'one_off',
}

export const RECURRENCE_FREQUENCY_VALUES: readonly RecurrenceFrequency[] =
  Object.values(RecurrenceFrequency);

/**
 * Who a session/schedule is visible to. Coaches-only hides a session from the
 * member calendar; team is the default; public is reserved for open events.
 */
export enum SessionVisibility {
  Team = 'team',
  Coaches = 'coaches',
  Public = 'public',
}

export const SESSION_VISIBILITY_VALUES: readonly SessionVisibility[] =
  Object.values(SessionVisibility);

/** Soft-archive lifecycle for a recurring schedule template. */
export enum ScheduleStatus {
  Active = 'active',
  Archived = 'archived',
}

export const SCHEDULE_STATUS_VALUES: readonly ScheduleStatus[] =
  Object.values(ScheduleStatus);
