/**
 * Enumerations for practice RSVP / availability. RSVP models *intention*, kept
 * strictly separate from attendance (module 202) and never linked to points.
 * Every enum ships a `*_VALUES` array so DTO validation and pure guards reference
 * the canonical set without re-listing literals. Values are the stable strings
 * persisted in the database.
 */

/**
 * A member's effective availability answer for a session. `NoResponse` is a real,
 * modelled state (the absence of an answer) rather than an implied blank, so a
 * read for a member who has not answered yet returns an explicit `no_response`.
 */
export enum RsvpStatus {
  Going = 'going',
  NotGoing = 'not_going',
  Maybe = 'maybe',
  NoResponse = 'no_response',
}

export const RSVP_STATUS_VALUES: readonly RsvpStatus[] =
  Object.values(RsvpStatus);

/**
 * Optional coarse category explaining a non-going answer, used for privacy-safe
 * planning aggregates without exposing a free-text reason. Null when unspecified
 * (null-not-zero: an unspecified reason is never coerced to a default bucket).
 */
export enum RsvpReasonCategory {
  Injury = 'injury',
  Work = 'work',
  Travel = 'travel',
  Personal = 'personal',
  Other = 'other',
}

export const RSVP_REASON_CATEGORY_VALUES: readonly RsvpReasonCategory[] =
  Object.values(RsvpReasonCategory);

/**
 * Who may read a member's RSVP note. `Coaches` (default) keeps the note visible to
 * staff only; `Team` opts into showing it to teammates. Notes are never part of
 * privacy-safe aggregates or the team-readable participant list regardless.
 */
export enum RsvpNoteVisibility {
  Coaches = 'coaches',
  Team = 'team',
}

export const RSVP_NOTE_VISIBILITY_VALUES: readonly RsvpNoteVisibility[] =
  Object.values(RsvpNoteVisibility);

/**
 * How a response was recorded: the member themselves, a coach/admin override, an
 * import, or a system action (e.g. a waitlist promotion). The source is audited
 * and drives the "self vs override" distinction the product requires.
 */
export enum RsvpSource {
  Self = 'self',
  Coach = 'coach',
  Admin = 'admin',
  Import = 'import',
  System = 'system',
}

export const RSVP_SOURCE_VALUES: readonly RsvpSource[] =
  Object.values(RsvpSource);
