import type { ErrorMessageKey } from '@core/errors/error.types';

// --- API surface -------------------------------------------------------------

export const POINTS_API_TAG = 'points';
export const POINTS_ROUTE = 'teams/:teamId/points';
export const MY_POINTS_ROUTE = 'teams/:teamId/my-points';
export const POINTS_RULES_ROUTE = 'teams/:teamId/points-rules';

export const TEAM_ID_PARAM = 'teamId';
export const MEMBERSHIP_ID_PARAM = 'membershipId';
export const RULE_ID_PARAM = 'ruleId';

export const POINTS_MEMBER_ROUTE = ':membershipId';
export const POINTS_ADJUSTMENT_ROUTE = ':membershipId/adjustments';
export const RULE_TRANSITION_ROUTE = ':ruleId/transition';

// --- Pagination --------------------------------------------------------------

export const LIST_DEFAULT_LIMIT = 20;
export const LIST_MAX_LIMIT = 100;
export const LIST_MIN_LIMIT = 1;
export const LIST_DEFAULT_OFFSET = 0;

/** A member's ledger history is bounded — the most recent entries only. */
export const LEDGER_HISTORY_LIMIT = 200;
export const PLAYER_BADGE_LIMIT = 100;

// --- Rule / entry bounds -----------------------------------------------------

export const RULE_KEY_MIN_LENGTH = 2;
export const RULE_KEY_MAX_LENGTH = 100;
export const RULE_NAME_MIN_LENGTH = 2;
export const RULE_NAME_MAX_LENGTH = 200;
export const RULE_DESCRIPTION_MAX_LENGTH = 2000;
export const RULE_ENTRIES_MIN_ITEMS = 1;
export const RULE_ENTRIES_MAX_ITEMS = 50;
export const ACTIVITY_CATEGORY_MIN_LENGTH = 2;
export const ACTIVITY_CATEGORY_MAX_LENGTH = 50;
export const ENTRY_POINTS_MIN = 0;
export const ENTRY_POINTS_MAX = 10_000;
export const ENTRY_CAP_MIN = 1;
export const ENTRY_CAP_MAX = 1000;
export const ENTRY_COOLDOWN_MIN = 0;
export const ENTRY_COOLDOWN_MAX = 365;
export const RECORD_VERSION_MIN = 1;
export const FIRST_RULE_VERSION = 1;

// --- Adjustment bounds -------------------------------------------------------

export const ADJUSTMENT_AMOUNT_MIN = -10_000;
export const ADJUSTMENT_AMOUNT_MAX = 10_000;
export const ADJUSTMENT_REASON_MIN_LENGTH = 3;
export const ADJUSTMENT_REASON_MAX_LENGTH = 500;
export const OPERATION_KEY_MIN_LENGTH = 8;
export const OPERATION_KEY_MAX_LENGTH = 200;

/** ISO date-only (YYYY-MM-DD) — rule effective windows are calendar days. */
export const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;

/** Length of the ISO date-only prefix (YYYY-MM-DD) of an ISO timestamp. */
export const ISO_DATE_LENGTH = 10;

/** Sentinel used in COALESCE unique indexes so global (team_id NULL) rules dedupe. */
export const GLOBAL_SCOPE_SENTINEL = '00000000-0000-0000-0000-000000000000';

/** Milliseconds in one calendar day — the unit of the cooldown window. */
export const MILLISECONDS_PER_DAY = 86_400_000;

// --- Idempotency key prefixes ------------------------------------------------

export const AWARD_KEY_PREFIX = 'award';
export const REVERSAL_KEY_PREFIX = 'reversal';
export const ADJUSTMENT_KEY_PREFIX = 'adjust';
export const KEY_SEGMENT_SEPARATOR = ':';

// --- Seeded legacy candidate rule -------------------------------------------

/** Stable id of the seeded external-training point candidate (a DRAFT). */
export const LEGACY_POINTS_RULE_ID = '40200000-0000-4000-9000-000000000001';
export const LEGACY_POINTS_RULE_KEY = 'external_training';
export const LEGACY_POINTS_RULE_NAME = 'External training point candidates';

// --- Seeded badge definition ids --------------------------------------------

export const TROPHY_BADGE_ID = '40200000-0000-4000-9000-0000000000b1';
export const GLOBE_BADGE_ID = '40200000-0000-4000-9000-0000000000b2';
export const DRAGON_BADGE_ID = '40200000-0000-4000-9000-0000000000b3';
export const BROKEN_TIER_BADGE_ID = '40200000-0000-4000-9000-0000000000b4';

// --- Error messages ----------------------------------------------------------

export const RULE_NOT_FOUND_MESSAGE = 'The requested points rule was not found';
export const RULE_NOT_FOUND_MESSAGE_KEY: ErrorMessageKey =
  'errors.points.ruleNotFound';
export const RULE_INVALID_TRANSITION_MESSAGE =
  'The points rule cannot make this lifecycle transition';
export const RULE_INVALID_TRANSITION_MESSAGE_KEY: ErrorMessageKey =
  'errors.points.ruleInvalidTransition';
export const RULE_VERSION_CONFLICT_MESSAGE =
  'The points rule was modified concurrently';
export const RULE_VERSION_CONFLICT_MESSAGE_KEY: ErrorMessageKey =
  'errors.points.ruleVersionConflict';
export const POINTS_VALIDATION_MESSAGE =
  'The points request failed a domain validation rule';
export const POINTS_VALIDATION_MESSAGE_KEY: ErrorMessageKey =
  'errors.points.validation';
export const POINTS_SCOPE_NOT_FOUND_MESSAGE =
  'The team, season, or membership scope was not found';
export const POINTS_SCOPE_NOT_FOUND_MESSAGE_KEY: ErrorMessageKey =
  'errors.points.scopeNotFound';
export const ADJUSTMENT_CONFLICT_MESSAGE =
  'A points adjustment with this operation key already exists';
export const ADJUSTMENT_CONFLICT_MESSAGE_KEY: ErrorMessageKey =
  'errors.points.adjustmentConflict';

// --- Audit actions / resources ----------------------------------------------

export const LEDGER_RESOURCE_TYPE = 'points_ledger_entry';
export const LEDGER_AGGREGATE = 'points_ledger';
export const RULE_RESOURCE_TYPE = 'points_rule';
export const RULE_AGGREGATE = 'points_rule';
export const BADGE_AGGREGATE = 'player_badge';

export const POINTS_AWARDED_ACTION = 'points.awarded';
export const POINTS_REVERSED_ACTION = 'points.reversed';
export const POINTS_ADJUSTED_ACTION = 'points.adjusted';
export const RULE_CREATED_ACTION = 'points.rule.created';
export const RULE_TRANSITIONED_ACTION = 'points.rule.transitioned';

// --- Domain events (past-tense, versioned, privacy-safe payloads) ------------

export const POINTS_EVENT_VERSION = 1;
export const POINTS_AWARDED_EVENT = 'points.awarded.v1';
export const POINTS_REVERSED_EVENT = 'points.reversed.v1';
export const POINTS_ADJUSTED_EVENT = 'points.adjusted.v1';
export const BADGE_EARNED_EVENT = 'points.badge.earned.v1';
export const RULE_CREATED_EVENT = 'points.rule.created.v1';
export const RULE_PUBLISHED_EVENT = 'points.rule.published.v1';
export const RULE_RETIRED_EVENT = 'points.rule.retired.v1';

// --- Static column lists (never SELECT *) ------------------------------------

export const POINTS_RULE_COLUMNS = `"id", "team_id", "season_id", "rule_key",
  "version", "name", "description", "status", "point_entries", "effective_from",
  "effective_to", "record_version", "created_by", "published_by", "published_at",
  "retired_at", "created_at", "updated_at"`;

export const LEDGER_ENTRY_COLUMNS = `"id", "team_id", "season_id", "membership_id",
  "entry_type", "amount", "source_type", "source_id", "rule_id", "rule_version",
  "activity_category", "reason", "reason_key", "reverses_entry_id",
  "idempotency_key", "effective_on", "actor_user_id", "created_at"`;

export const BADGE_DEFINITION_COLUMNS = `"id", "team_id", "badge_key", "name",
  "description", "threshold", "status", "icon"`;

export const PLAYER_BADGE_COLUMNS = `"id", "team_id", "membership_id",
  "badge_definition_id", "badge_key", "threshold", "points_at_award",
  "awarded_by", "awarded_at"`;
