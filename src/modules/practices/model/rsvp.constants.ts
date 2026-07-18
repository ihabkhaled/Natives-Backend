import type { ErrorMessageKey } from '@core/errors/error.types';

// --- Routes (team + session scoped, mounted under PRACTICES_ROUTE = 'teams') ---
export const RSVP_SELF_ROUTE = ':teamId/practice-sessions/:sessionId/rsvp';
export const RSVP_LIST_ROUTE = ':teamId/practice-sessions/:sessionId/rsvps';
export const RSVP_SUMMARY_ROUTE =
  ':teamId/practice-sessions/:sessionId/rsvps/summary';
export const RSVP_OVERRIDE_ROUTE =
  ':teamId/practice-sessions/:sessionId/rsvps/:membershipId';
export const RSVP_HISTORY_ROUTE =
  ':teamId/practice-sessions/:sessionId/rsvps/:membershipId/history';

export const MEMBERSHIP_ID_PARAM = 'membershipId';

// --- Field bounds ------------------------------------------------------------
export const NOTE_MAX_LENGTH = 1000;
export const OVERRIDE_REASON_MIN_LENGTH = 1;
export const OVERRIDE_REASON_MAX_LENGTH = 512;

// --- Bounded read limits -----------------------------------------------------
export const RSVP_HISTORY_SCAN_LIMIT = 500;

// --- Domain event envelope ---------------------------------------------------
export const RSVP_AGGREGATE_TYPE = 'practice_rsvp';
export const RSVP_EVENT_VERSION = 1;
export const RSVP_RECORDED_EVENT = 'practice.rsvp.recorded';
export const RSVP_PROMOTED_EVENT = 'practice.rsvp.promoted';
// Payload key the platform notification projector reads to target a recipient
// other than the actor — mirrors the platform RECIPIENT_PAYLOAD_KEY convention so
// change/waitlist reminders route to the affected member through outbox/preferences.
export const RSVP_RECIPIENT_KEY = 'recipientUserId';

// --- Audit actions -----------------------------------------------------------
export const RSVP_RECORDED_ACTION = 'practice.rsvpRecorded';
export const RSVP_OVERRIDDEN_ACTION = 'practice.rsvpOverridden';
export const RSVP_PROMOTED_ACTION = 'practice.rsvpPromoted';
export const RSVP_RESOURCE_TYPE = 'practice_rsvp';

// --- Static read-column lists (never interpolate caller input) ----------------
export const RSVP_COLUMNS = `"id", "session_id", "team_id", "season_id",
  "membership_id", "user_id", "status", "reason_category", "note",
  "note_visibility", "source", "waitlisted", "responded_at", "created_by",
  "updated_by", "created_at", "updated_at", "version"`;

export const RSVP_REVISION_COLUMNS = `"id", "rsvp_id", "session_id",
  "membership_id", "from_status", "to_status", "reason_category", "note",
  "waitlisted", "source", "is_override", "override_reason", "actor_user_id",
  "occurred_at"`;

// --- Error messages & keys ---------------------------------------------------
export const RSVP_CLOSED_MESSAGE =
  'RSVP is not open for this session in its current state';
export const RSVP_CLOSED_MESSAGE_KEY: ErrorMessageKey =
  'errors.practices.rsvpClosed';

export const RSVP_DEADLINE_PASSED_MESSAGE =
  'The RSVP deadline for this session has passed';
export const RSVP_DEADLINE_PASSED_MESSAGE_KEY: ErrorMessageKey =
  'errors.practices.rsvpDeadlinePassed';

export const RSVP_NOT_MEMBER_MESSAGE =
  'You are not an active member of this team';
export const RSVP_NOT_MEMBER_MESSAGE_KEY: ErrorMessageKey =
  'errors.practices.rsvpNotMember';

export const RSVP_MEMBERSHIP_NOT_FOUND_MESSAGE =
  'The membership was not found in this team scope';
export const RSVP_MEMBERSHIP_NOT_FOUND_MESSAGE_KEY: ErrorMessageKey =
  'errors.practices.rsvpMembershipNotFound';
