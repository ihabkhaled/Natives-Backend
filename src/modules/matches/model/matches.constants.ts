import type { ErrorMessageKey } from '@core/errors/error.types';

// --- API surface -------------------------------------------------------------

export const MATCHES_API_TAG = 'matches';
export const MATCHES_ROUTE = 'teams/:teamId/matches';
export const MATCH_EVENTS_ROUTE = 'teams/:teamId/matches/:matchId/events';
export const MATCH_RULESETS_ROUTE = 'teams/:teamId/match-rulesets';

export const TEAM_ID_PARAM = 'teamId';
export const MATCH_ID_PARAM = 'matchId';

export const MATCH_ITEM_ROUTE = ':matchId';
export const MATCH_TRANSITION_ROUTE = ':matchId/transition';
export const MATCH_FINALIZE_ROUTE = ':matchId/finalization';
export const MATCH_REOPEN_ROUTE = ':matchId/reopening';
export const MATCH_SCOREBOARD_ROUTE = ':matchId/scoreboard';
export const MATCH_REVISIONS_ROUTE = ':matchId/revisions';
export const MATCH_POINT_ROUTE = 'point';
export const MATCH_TIMEOUT_ROUTE = 'timeout';
export const MATCH_VOID_ROUTE = 'void';

// --- Pagination --------------------------------------------------------------

export const LIST_DEFAULT_LIMIT = 20;
export const LIST_MAX_LIMIT = 100;
export const LIST_MIN_LIMIT = 1;
export const LIST_DEFAULT_OFFSET = 0;

/** The append-only event feed allows a larger page but is still hard-bounded. */
export const EVENT_MAX_LIMIT = 500;
export const EVENT_DEFAULT_LIMIT = 200;

// --- Field bounds ------------------------------------------------------------

export const NAME_MIN_LENGTH = 2;
export const NAME_MAX_LENGTH = 160;
export const KEY_MIN_LENGTH = 2;
export const KEY_MAX_LENGTH = 64;
export const NOTES_MAX_LENGTH = 2000;
export const REASON_MIN_LENGTH = 5;
export const REASON_MAX_LENGTH = 500;
export const OPERATION_ID_MIN_LENGTH = 8;
export const OPERATION_ID_MAX_LENGTH = 128;
export const RECORD_VERSION_MIN = 1;
export const STREAM_VERSION_MIN = 0;

export const GAME_TO_MIN = 1;
export const GAME_TO_MAX = 99;
export const WIN_BY_MIN = 1;
export const WIN_BY_MAX = 5;
export const CAP_MIN = 1;
export const CAP_MAX = 199;
export const MINUTES_MIN = 1;
export const MINUTES_MAX = 600;
export const TIMEOUTS_MIN = 0;
export const TIMEOUTS_MAX = 10;
export const PERIODS_MIN = 1;
export const PERIODS_MAX = 8;
export const POINTS_MIN = 1;
export const POINTS_MAX = 3;
export const RULESET_VERSION_MIN = 1;
export const SCORE_MIN = 0;

/** The scoreboard rule engine's own named version, cited by every projection. */
export const MATCH_ENGINE_VERSION = 'match-scoring-v1';

/** The revision a brand-new match starts at, and the first stream sequence. */
export const FIRST_REVISION = 1;
export const FIRST_SEQUENCE = 1;
export const FIRST_PERIOD = 1;
export const INITIAL_STREAM_VERSION = 0;

/** A plain point is worth exactly one; the ruleset never scales it silently. */
export const DEFAULT_POINT_VALUE = 1;

// --- Error messages ----------------------------------------------------------

export const MATCH_NOT_FOUND_MESSAGE = 'The requested match was not found';
export const MATCH_NOT_FOUND_MESSAGE_KEY: ErrorMessageKey =
  'errors.matches.matchNotFound';
export const MATCH_SCOPE_NOT_FOUND_MESSAGE =
  'The team, season, competition, fixture, or roster scope was not found';
export const MATCH_SCOPE_NOT_FOUND_MESSAGE_KEY: ErrorMessageKey =
  'errors.matches.scopeNotFound';
export const MATCH_RULESET_NOT_FOUND_MESSAGE =
  'The requested match ruleset was not found or is not active';
export const MATCH_RULESET_NOT_FOUND_MESSAGE_KEY: ErrorMessageKey =
  'errors.matches.rulesetNotFound';
export const MATCH_EVENT_NOT_FOUND_MESSAGE =
  'The requested match event was not found on this match';
export const MATCH_EVENT_NOT_FOUND_MESSAGE_KEY: ErrorMessageKey =
  'errors.matches.eventNotFound';
export const MATCH_VALIDATION_MESSAGE =
  'The match request failed a domain validation rule';
export const MATCH_VALIDATION_MESSAGE_KEY: ErrorMessageKey =
  'errors.matches.validation';
export const MATCH_INVALID_TRANSITION_MESSAGE =
  'The match cannot make this lifecycle transition';
export const MATCH_INVALID_TRANSITION_MESSAGE_KEY: ErrorMessageKey =
  'errors.matches.matchInvalidTransition';
export const MATCH_VERSION_CONFLICT_MESSAGE =
  'The match was modified concurrently';
export const MATCH_VERSION_CONFLICT_MESSAGE_KEY: ErrorMessageKey =
  'errors.matches.matchVersionConflict';
export const MATCH_FINALIZED_MESSAGE =
  'The match is finalized and immutable; reopen it with a reason to correct it';
export const MATCH_FINALIZED_MESSAGE_KEY: ErrorMessageKey =
  'errors.matches.matchFinalized';
export const MATCH_NOT_SCORING_MESSAGE =
  'The match is not live, so it cannot accept score events';
export const MATCH_NOT_SCORING_MESSAGE_KEY: ErrorMessageKey =
  'errors.matches.matchNotScoring';
export const MATCH_OPERATION_CONFLICT_MESSAGE =
  'That client operation id was already recorded with a different payload';
export const MATCH_OPERATION_CONFLICT_MESSAGE_KEY: ErrorMessageKey =
  'errors.matches.operationConflict';
export const MATCH_TIMEOUTS_EXHAUSTED_MESSAGE =
  'That side has no timeouts left in this period under the active ruleset';
export const MATCH_TIMEOUTS_EXHAUSTED_MESSAGE_KEY: ErrorMessageKey =
  'errors.matches.timeoutsExhausted';
export const MATCH_REOPEN_NOT_ALLOWED_MESSAGE =
  'Only a finalized match can be reopened for correction';
export const MATCH_REOPEN_NOT_ALLOWED_MESSAGE_KEY: ErrorMessageKey =
  'errors.matches.reopenNotAllowed';

/** The recorded reason on the revision row a plain finalization appends. */
export const MATCH_FINALIZE_REASON =
  'Authoritative result published from the match event stream';

// --- Audit actions / resources ----------------------------------------------

export const MATCH_RESOURCE_TYPE = 'match';
export const MATCH_AGGREGATE = 'match';
export const MATCH_EVENT_RESOURCE_TYPE = 'match_event';
export const MATCH_RULESET_RESOURCE_TYPE = 'match_ruleset';
export const MATCH_REVISION_RESOURCE_TYPE = 'match_revision';

export const MATCH_CREATED_ACTION = 'match.created';
export const MATCH_TRANSITIONED_ACTION = 'match.transitioned';
export const MATCH_SCORED_ACTION = 'match.scored';
export const MATCH_TIMEOUT_ACTION = 'match.timeout';
export const MATCH_EVENT_VOIDED_ACTION = 'match.event.voided';
export const MATCH_FINALIZED_ACTION = 'match.finalized';
export const MATCH_REOPENED_ACTION = 'match.reopened';
export const MATCH_RULESET_CREATED_ACTION = 'match.ruleset.created';

// --- Domain events (past-tense, versioned, privacy-safe payloads) ------------

export const MATCHES_EVENT_VERSION = 1;
export const MATCH_STARTED_EVENT = 'match.started.v1';
export const MATCH_STATE_CHANGED_EVENT = 'match.state_changed.v1';
export const MATCH_FINALIZED_EVENT = 'match.finalized.v1';
export const MATCH_REOPENED_EVENT = 'match.reopened.v1';

// --- Static column lists (never SELECT *) ------------------------------------

export const MATCH_COLUMNS = `"id", "team_id", "season_id", "competition_id",
  "fixture_id", "roster_id", "ruleset_id", "status", "home_away", "our_score",
  "opponent_score", "period", "stream_version", "record_version", "revision",
  "result", "cap_applied", "engine_version", "supersedes_match_id",
  "reopen_reason", "reopened_by", "reopened_at", "created_by", "started_at",
  "paused_at", "resumed_at", "halftime_at", "completed_at", "finalized_by",
  "finalized_at", "abandoned_at", "abandon_reason", "notes", "created_at",
  "updated_at"`;

/**
 * The physical stream columns. `voided` is deliberately NOT one of them: an
 * accepted fact is never rewritten, so voided-ness is DERIVED from the existence
 * of a compensating void event pointing back at the row.
 */
export const MATCH_EVENT_COLUMNS = `"id", "match_id", "team_id", "sequence",
  "operation_id", "request_hash", "event_type", "scoring_side", "points",
  "our_score_after", "opponent_score_after", "period", "scorer_membership_id",
  "assist_membership_id", "voids_event_id", "void_reason", "recorded_by",
  "occurred_at", "recorded_at"`;

/** The same columns qualified for the aliased read that derives `voided`. */
export const MATCH_EVENT_SELECT_COLUMNS = `e."id", e."match_id", e."team_id",
  e."sequence", e."operation_id", e."request_hash", e."event_type",
  e."scoring_side", e."points", e."our_score_after", e."opponent_score_after",
  e."period", e."scorer_membership_id", e."assist_membership_id",
  e."voids_event_id", e."void_reason", e."recorded_by", e."occurred_at",
  e."recorded_at"`;

/** A fact is voided exactly when a later compensating event points at it. */
export const MATCH_EVENT_VOIDED_EXPRESSION = `EXISTS (
    SELECT 1 FROM "match_events" v WHERE v."voids_event_id" = e."id"
  ) AS "voided"`;

/** A freshly appended fact can never already be voided. */
export const MATCH_EVENT_NOT_VOIDED = `false AS "voided"`;

export const MATCH_RULESET_COLUMNS = `"id", "team_id", "season_id",
  "ruleset_key", "ruleset_version", "name", "game_to", "win_by", "hard_cap",
  "soft_cap_minutes", "soft_cap_plus", "time_cap_minutes", "halftime_at",
  "timeouts_per_team", "timeouts_per_period", "periods", "status", "notes",
  "created_by", "created_at", "updated_at"`;

export const MATCH_REVISION_COLUMNS = `"id", "match_id", "team_id", "sequence", "revision",
  "action", "reason", "from_status", "to_status", "our_score_before",
  "opponent_score_before", "our_score_after", "opponent_score_after",
  "stream_version", "actor_user_id", "created_at"`;

/** Live match states — the ones a fixture may hold at most one of. */
export const LIVE_MATCH_STATES = `('scheduled', 'ready', 'live', 'paused',
  'halftime', 'completed')`;
