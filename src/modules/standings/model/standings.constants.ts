import type { ErrorMessageKey } from '@core/errors/error.types';

import { StandingTieBreak } from './standings.enums';

// --- API surface -------------------------------------------------------------

export const STANDINGS_API_TAG = 'standings';
export const STANDINGS_ROUTE = 'teams/:teamId/standings';
export const STANDINGS_RULES_ROUTE = 'teams/:teamId/standings-rules';
export const ACHIEVEMENTS_ROUTE = 'teams/:teamId/achievements';
export const TEAM_HISTORY_ROUTE = 'teams/:teamId/history';

export const TEAM_ID_PARAM = 'teamId';
export const ACHIEVEMENT_ID_PARAM = 'achievementId';

export const STANDINGS_RECOMPUTE_ROUTE = 'recompute';
export const STANDINGS_MANUAL_ROUTE = 'manual';
export const ACHIEVEMENT_ITEM_ROUTE = ':achievementId';
export const ACHIEVEMENT_TRANSITION_ROUTE = ':achievementId/transition';
export const ACHIEVEMENT_IMPORT_ROUTE = 'import';

// --- Pagination --------------------------------------------------------------

export const LIST_DEFAULT_LIMIT = 20;
export const LIST_MAX_LIMIT = 100;
export const LIST_MIN_LIMIT = 1;
export const LIST_DEFAULT_OFFSET = 0;

/** A standings table is read whole, so it gets a larger but still hard cap. */
export const STANDINGS_MAX_LIMIT = 200;
export const STANDINGS_DEFAULT_LIMIT = 100;

/** Hard ceiling on how many finalized matches one recompute may fold. */
export const RECOMPUTE_MAX_MATCHES = 500;

// --- Field bounds ------------------------------------------------------------

export const NAME_MIN_LENGTH = 2;
export const NAME_MAX_LENGTH = 160;
export const DESCRIPTION_MAX_LENGTH = 2000;
export const NOTE_MIN_LENGTH = 3;
export const NOTE_MAX_LENGTH = 1000;
export const REFERENCE_MAX_LENGTH = 400;
export const POOL_LABEL_MAX_LENGTH = 40;
export const RULE_KEY_MIN_LENGTH = 2;
export const RULE_KEY_MAX_LENGTH = 60;
export const RECORD_VERSION_MIN = 1;
export const IMPORT_MAX_ROWS = 500;

export const RULE_POINTS_MIN = -10;
export const RULE_POINTS_MAX = 10;
export const SCORE_MIN = 0;
export const SCORE_MAX = 999;
export const COUNT_MAX = 999;
export const PLACE_MIN = 1;
export const PLACE_MAX = 999;
export const SPIRIT_MIN = 0;
export const SPIRIT_MAX = 20;

/** The first version number a named rule key is written at. */
export const FIRST_RULE_VERSION = 1;

/** WFDF-style defaults used when a rule version omits an explicit value. */
export const DEFAULT_WIN_POINTS = 3;
export const DEFAULT_LOSS_POINTS = 0;
export const DEFAULT_TIE_POINTS = 1;

/**
 * The default tie-break ordering. It is DATA, copied into each rule version at
 * creation: changing this constant never re-orders an already-computed table.
 */
export const DEFAULT_TIE_BREAK_ORDER: readonly StandingTieBreak[] = [
  StandingTieBreak.StandingPoints,
  StandingTieBreak.Wins,
  StandingTieBreak.PointDifference,
  StandingTieBreak.PointsFor,
  StandingTieBreak.Alphabetical,
];

/** The match statuses a derived standing may be folded from. */
export const FINALIZED_MATCH_STATUS = 'finalized';

// --- Error messages ----------------------------------------------------------

export const STANDING_NOT_FOUND_MESSAGE =
  'The requested standings row was not found';
export const STANDING_NOT_FOUND_MESSAGE_KEY: ErrorMessageKey =
  'errors.standings.standingNotFound';
export const STANDINGS_RULE_NOT_FOUND_MESSAGE =
  'The requested standings rule version was not found';
export const STANDINGS_RULE_NOT_FOUND_MESSAGE_KEY: ErrorMessageKey =
  'errors.standings.ruleNotFound';
export const STANDINGS_SCOPE_NOT_FOUND_MESSAGE =
  'The team, season, competition, or stage scope was not found';
export const STANDINGS_SCOPE_NOT_FOUND_MESSAGE_KEY: ErrorMessageKey =
  'errors.standings.scopeNotFound';
export const ACHIEVEMENT_NOT_FOUND_MESSAGE =
  'The requested achievement was not found';
export const ACHIEVEMENT_NOT_FOUND_MESSAGE_KEY: ErrorMessageKey =
  'errors.standings.achievementNotFound';
export const STANDINGS_VALIDATION_MESSAGE =
  'The standings request failed a domain validation rule';
export const STANDINGS_VALIDATION_MESSAGE_KEY: ErrorMessageKey =
  'errors.standings.validation';
export const STANDINGS_PROVENANCE_MESSAGE =
  'A manual or imported standings row must carry a reconciliation note';
export const STANDINGS_PROVENANCE_MESSAGE_KEY: ErrorMessageKey =
  'errors.standings.provenanceRequired';
export const ACHIEVEMENT_INVALID_TRANSITION_MESSAGE =
  'The achievement cannot make this approval transition';
export const ACHIEVEMENT_INVALID_TRANSITION_MESSAGE_KEY: ErrorMessageKey =
  'errors.standings.achievementInvalidTransition';
export const STANDINGS_VERSION_CONFLICT_MESSAGE =
  'The record was modified concurrently';
export const STANDINGS_VERSION_CONFLICT_MESSAGE_KEY: ErrorMessageKey =
  'errors.standings.versionConflict';

// --- Audit actions / resources ----------------------------------------------

export const STANDING_RESOURCE_TYPE = 'competition_standing';
export const STANDINGS_RULE_RESOURCE_TYPE = 'standings_rule_version';
export const ACHIEVEMENT_RESOURCE_TYPE = 'team_achievement';
export const ACHIEVEMENT_AGGREGATE = 'team_achievement';
export const STANDING_AGGREGATE = 'competition_standing';

export const STANDINGS_RULE_CREATED_ACTION = 'standings.rule.created';
export const STANDINGS_RECOMPUTED_ACTION = 'standings.recomputed';
export const STANDINGS_MANUAL_ACTION = 'standings.manual.recorded';
export const ACHIEVEMENT_CREATED_ACTION = 'achievement.created';
export const ACHIEVEMENT_TRANSITIONED_ACTION = 'achievement.transitioned';
export const ACHIEVEMENT_IMPORTED_ACTION = 'achievement.imported';

// --- Domain events -----------------------------------------------------------

export const STANDINGS_EVENT_VERSION = 1;
export const STANDINGS_RECOMPUTED_EVENT = 'standings.recomputed.v1';
export const ACHIEVEMENT_APPROVED_EVENT = 'achievement.approved.v1';

// --- Static column lists (never SELECT *) ------------------------------------

export const RULE_VERSION_COLUMNS = `"id", "team_id", "rule_key", "version",
  "name", "win_points", "loss_points", "tie_points", "tie_break_order",
  "effective_from", "status", "created_by", "created_at"`;

export const STANDING_COLUMNS = `"id", "team_id", "season_id", "competition_id",
  "stage_id", "rule_version_id", "pool_label", "entrant_kind", "opponent_id",
  "played", "wins", "losses", "ties", "points_for", "points_against",
  "standing_points", "spirit_score", "final_place", "qualification", "source",
  "source_reference", "reconciliation_note", "record_version", "recorded_by",
  "computed_at", "created_at", "updated_at"`;

export const ACHIEVEMENT_COLUMNS = `"id", "team_id", "season_id",
  "competition_id", "membership_id", "category", "title", "description",
  "achieved_on", "evidence_reference", "visibility", "status", "source",
  "import_reference", "record_version", "created_by", "approved_by",
  "approved_at", "rejected_at", "archived_at", "created_at", "updated_at"`;

/**
 * Idempotent standings upsert keyed by (competition, stage, entrant, opponent),
 * so re-running a recompute converges on the same table rather than piling up
 * duplicate rows.
 */
export const STANDING_UPSERT_SQL = `INSERT INTO "competition_standings"
    ("id", "team_id", "season_id", "competition_id", "stage_id",
     "rule_version_id", "pool_label", "entrant_kind", "opponent_id",
     "played", "wins", "losses", "ties", "points_for", "points_against",
     "standing_points", "spirit_score", "final_place", "qualification",
     "source", "source_reference", "reconciliation_note", "recorded_by",
     "computed_at", "created_at", "updated_at")
   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
           $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $24, $24)
   ON CONFLICT ("competition_id",
     COALESCE("stage_id", '00000000-0000-0000-0000-000000000000'::uuid),
     "entrant_kind",
     COALESCE("opponent_id", '00000000-0000-0000-0000-000000000000'::uuid))
   DO UPDATE SET
     "rule_version_id" = EXCLUDED."rule_version_id",
     "pool_label" = EXCLUDED."pool_label",
     "played" = EXCLUDED."played",
     "wins" = EXCLUDED."wins",
     "losses" = EXCLUDED."losses",
     "ties" = EXCLUDED."ties",
     "points_for" = EXCLUDED."points_for",
     "points_against" = EXCLUDED."points_against",
     "standing_points" = EXCLUDED."standing_points",
     "spirit_score" = EXCLUDED."spirit_score",
     "final_place" = EXCLUDED."final_place",
     "qualification" = EXCLUDED."qualification",
     "source" = EXCLUDED."source",
     "source_reference" = EXCLUDED."source_reference",
     "reconciliation_note" = EXCLUDED."reconciliation_note",
     "recorded_by" = EXCLUDED."recorded_by",
     "computed_at" = EXCLUDED."computed_at",
     "updated_at" = EXCLUDED."updated_at",
     "record_version" = "competition_standings"."record_version" + 1
   RETURNING ${STANDING_COLUMNS}`;
