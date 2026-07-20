import type { ErrorMessageKey } from '@core/errors/error.types';

// --- API surface -------------------------------------------------------------

export const COMPETITIONS_API_TAG = 'competitions';
export const COMPETITIONS_ROUTE = 'teams/:teamId/competitions';
export const OPPONENTS_ROUTE = 'teams/:teamId/opponents';
export const COMPETITION_CHILD_ROUTE =
  'teams/:teamId/competitions/:competitionId';
export const FIXTURES_ROUTE =
  'teams/:teamId/competitions/:competitionId/fixtures';

export const TEAM_ID_PARAM = 'teamId';
export const COMPETITION_ID_PARAM = 'competitionId';
export const FIXTURE_ID_PARAM = 'fixtureId';

export const COMPETITION_ITEM_ROUTE = ':competitionId';
export const COMPETITION_TRANSITION_ROUTE = ':competitionId/transition';
export const STAGES_SUBROUTE = 'stages';
export const ROUNDS_SUBROUTE = 'rounds';
export const STRUCTURE_SUBROUTE = 'structure';
export const FIXTURE_RESCHEDULE_ROUTE = ':fixtureId/reschedule';
export const FIXTURE_TRANSITION_ROUTE = ':fixtureId/transition';

// --- Pagination --------------------------------------------------------------

export const LIST_DEFAULT_LIMIT = 20;
export const LIST_MAX_LIMIT = 100;
export const LIST_MIN_LIMIT = 1;
export const LIST_DEFAULT_OFFSET = 0;

// --- Field bounds ------------------------------------------------------------

export const NAME_MIN_LENGTH = 2;
export const NAME_MAX_LENGTH = 160;
export const SHORT_NAME_MAX_LENGTH = 40;
export const DESCRIPTION_MAX_LENGTH = 2000;
export const ORGANIZER_MAX_LENGTH = 200;
export const EXTERNAL_REF_MAX_LENGTH = 500;
export const GENDER_DIVISION_MAX_LENGTH = 80;
export const LOGO_REF_MAX_LENGTH = 500;
export const CONTACT_NAME_MAX_LENGTH = 160;
export const CONTACT_INFO_MAX_LENGTH = 200;
export const NOTES_MAX_LENGTH = 2000;
export const REASON_MIN_LENGTH = 3;
export const REASON_MAX_LENGTH = 500;
export const STAGE_NAME_MAX_LENGTH = 120;
export const ROUND_NAME_MAX_LENGTH = 120;
export const RECORD_VERSION_MIN = 1;
export const FIRST_ORDINAL = 1;

/** ISO date-only (YYYY-MM-DD) — competition windows are calendar days. */
export const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;

/** Length of the ISO date-only prefix (YYYY-MM-DD) of an ISO timestamp. */
export const ISO_DATE_LENGTH = 10;

/** Presentation timezone for scheduled instants (stored UTC, shown in Cairo). */
export const CAIRO_TIMEZONE = 'Africa/Cairo';

// --- Error messages ----------------------------------------------------------

export const COMPETITION_NOT_FOUND_MESSAGE =
  'The requested competition was not found';
export const COMPETITION_NOT_FOUND_MESSAGE_KEY: ErrorMessageKey =
  'errors.competitions.competitionNotFound';
export const COMPETITION_INVALID_TRANSITION_MESSAGE =
  'The competition cannot make this lifecycle transition';
export const COMPETITION_INVALID_TRANSITION_MESSAGE_KEY: ErrorMessageKey =
  'errors.competitions.competitionInvalidTransition';
export const COMPETITION_VERSION_CONFLICT_MESSAGE =
  'The competition was modified concurrently';
export const COMPETITION_VERSION_CONFLICT_MESSAGE_KEY: ErrorMessageKey =
  'errors.competitions.competitionVersionConflict';
export const COMPETITION_VALIDATION_MESSAGE =
  'The competition request failed a domain validation rule';
export const COMPETITION_VALIDATION_MESSAGE_KEY: ErrorMessageKey =
  'errors.competitions.validation';
export const SCOPE_NOT_FOUND_MESSAGE =
  'The team, season, stage, round, or opponent scope was not found';
export const SCOPE_NOT_FOUND_MESSAGE_KEY: ErrorMessageKey =
  'errors.competitions.scopeNotFound';
export const OPPONENT_NOT_FOUND_MESSAGE =
  'The requested opponent was not found';
export const OPPONENT_NOT_FOUND_MESSAGE_KEY: ErrorMessageKey =
  'errors.competitions.opponentNotFound';
export const OPPONENT_CONFLICT_MESSAGE =
  'An opponent with this name already exists for the team';
export const OPPONENT_CONFLICT_MESSAGE_KEY: ErrorMessageKey =
  'errors.competitions.opponentConflict';
export const FIXTURE_NOT_FOUND_MESSAGE = 'The requested fixture was not found';
export const FIXTURE_NOT_FOUND_MESSAGE_KEY: ErrorMessageKey =
  'errors.competitions.fixtureNotFound';
export const FIXTURE_INVALID_TRANSITION_MESSAGE =
  'The fixture cannot make this lifecycle transition';
export const FIXTURE_INVALID_TRANSITION_MESSAGE_KEY: ErrorMessageKey =
  'errors.competitions.fixtureInvalidTransition';
export const FIXTURE_VERSION_CONFLICT_MESSAGE =
  'The fixture was modified concurrently';
export const FIXTURE_VERSION_CONFLICT_MESSAGE_KEY: ErrorMessageKey =
  'errors.competitions.fixtureVersionConflict';
export const FIXTURE_SCHEDULE_MESSAGE =
  'The fixture schedule failed a domain validation rule';
export const FIXTURE_SCHEDULE_MESSAGE_KEY: ErrorMessageKey =
  'errors.competitions.fixtureSchedule';

// --- Audit actions / resources ----------------------------------------------

export const COMPETITION_RESOURCE_TYPE = 'competition';
export const COMPETITION_AGGREGATE = 'competition';
export const STAGE_RESOURCE_TYPE = 'competition_stage';
export const ROUND_RESOURCE_TYPE = 'competition_round';
export const OPPONENT_RESOURCE_TYPE = 'opponent';
export const FIXTURE_RESOURCE_TYPE = 'fixture';
export const FIXTURE_AGGREGATE = 'fixture';

export const COMPETITION_CREATED_ACTION = 'competition.created';
export const COMPETITION_TRANSITIONED_ACTION = 'competition.transitioned';
export const STAGE_CREATED_ACTION = 'competition.stage.created';
export const ROUND_CREATED_ACTION = 'competition.round.created';
export const OPPONENT_CREATED_ACTION = 'opponent.created';
export const FIXTURE_CREATED_ACTION = 'fixture.created';
export const FIXTURE_RESCHEDULED_ACTION = 'fixture.rescheduled';
export const FIXTURE_TRANSITIONED_ACTION = 'fixture.transitioned';

// --- Domain events (past-tense, versioned, privacy-safe payloads) ------------

export const COMPETITIONS_EVENT_VERSION = 1;
export const COMPETITION_CREATED_EVENT = 'competition.created.v1';
export const COMPETITION_PUBLISHED_EVENT = 'competition.published.v1';
export const COMPETITION_CANCELLED_EVENT = 'competition.cancelled.v1';
export const FIXTURE_SCHEDULED_EVENT = 'fixture.scheduled.v1';
export const FIXTURE_RESCHEDULED_EVENT = 'fixture.rescheduled.v1';
export const FIXTURE_CANCELLED_EVENT = 'fixture.cancelled.v1';

// --- Static column lists (never SELECT *) ------------------------------------

export const COMPETITION_COLUMNS = `"id", "team_id", "season_id", "name",
  "competition_type", "status", "gender_division", "organizer_name",
  "external_ref", "starts_on", "ends_on", "description", "cancellation_reason",
  "record_version", "created_by", "published_by", "published_at", "activated_at",
  "completed_at", "cancelled_at", "archived_at", "created_at", "updated_at"`;

export const STAGE_COLUMNS = `"id", "competition_id", "name", "stage_format",
  "ordinal", "created_at", "updated_at"`;

export const ROUND_COLUMNS = `"id", "stage_id", "competition_id", "name",
  "ordinal", "created_at", "updated_at"`;

export const OPPONENT_COLUMNS = `"id", "team_id", "name", "short_name",
  "logo_ref", "contact_name", "contact_info", "notes", "status",
  "record_version", "created_by", "created_at", "updated_at"`;

export const FIXTURE_COLUMNS = `"id", "competition_id", "team_id", "season_id",
  "stage_id", "round_id", "opponent_id", "venue_id", "home_away", "scheduled_at",
  "status", "reschedule_count", "previous_scheduled_at", "reschedule_reason",
  "cancellation_reason", "record_version", "created_by", "rescheduled_at",
  "finalized_at", "cancelled_at", "created_at", "updated_at"`;
