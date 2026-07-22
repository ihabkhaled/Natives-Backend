import type { ErrorMessageKey } from '@core/errors/error.types';

// --- Ports -------------------------------------------------------------------

export const WORKBOOK_PARSER_PORT = Symbol('WORKBOOK_PARSER_PORT');

// --- API surface -------------------------------------------------------------

export const MIGRATION_API_TAG = 'migration';
export const IMPORTS_ROUTE = 'teams/:teamId/imports';
export const ALIASES_ROUTE = 'teams/:teamId/alias-resolutions';
export const COMPARISONS_ROUTE = 'teams/:teamId/formula-comparisons';

export const TEAM_ID_PARAM = 'teamId';
export const JOB_ID_PARAM = 'jobId';
export const RESOLUTION_ID_PARAM = 'resolutionId';
export const COMPARISON_ID_PARAM = 'comparisonId';

export const IMPORT_ITEM_ROUTE = ':jobId';
export const IMPORT_COMMIT_ROUTE = ':jobId/commit';
export const IMPORT_REVERSAL_ROUTE = ':jobId/reversal';
export const IMPORT_RESULTS_ROUTE = ':jobId/results';
export const RESOLUTION_ITEM_ROUTE = ':resolutionId';
export const RESOLUTION_REVIEW_ROUTE = ':resolutionId/review';
export const COMPARISON_ITEM_ROUTE = ':comparisonId';
export const COMPARISON_SIGNOFF_ROUTE = ':comparisonId/signoff';

// --- Pagination --------------------------------------------------------------

export const LIST_DEFAULT_LIMIT = 20;
export const LIST_MAX_LIMIT = 100;
export const LIST_MIN_LIMIT = 1;
export const LIST_DEFAULT_OFFSET = 0;
export const IMPORT_MAX_ROWS = 5000;
export const RESULTS_MAX_LIMIT = 500;

// --- Policy ------------------------------------------------------------------

export const MAPPER_VERSION = 'mapper-v1';
export const SOURCE_HASH_ALGORITHM = 'sha256';

/** Confidence at or above which an alias candidate is auto-confirmable. */
export const AUTO_CONFIRM_CONFIDENCE = 0.95;
/** Below this, a candidate is too weak to even suggest. */
export const SUGGEST_CONFIDENCE = 0.6;

/** A rounding tolerance under which a numeric difference is "matching". */
export const ROUNDING_TOLERANCE = 0.005;

/** The spreadsheet error tokens the parser must treat as untrusted. */
export const SPREADSHEET_ERROR_TOKENS: readonly string[] = [
  '#REF!',
  '#N/A',
  '#VALUE!',
  '#DIV/0!',
  '#NAME?',
  '#NULL!',
  '#NUM!',
];

/** The characters that begin a formula-injection cell. */
export const FORMULA_PREFIXES: readonly string[] = ['=', '+', '-', '@'];

// --- Field bounds ------------------------------------------------------------

export const NAME_MIN_LENGTH = 1;
export const NAME_MAX_LENGTH = 200;
export const REF_MAX_LENGTH = 200;
export const RECORD_VERSION_MIN = 1;

// --- Error messages ----------------------------------------------------------

export const IMPORT_JOB_NOT_FOUND_MESSAGE =
  'The requested import job was not found';
export const IMPORT_JOB_NOT_FOUND_MESSAGE_KEY: ErrorMessageKey =
  'errors.migration.importJobNotFound';
export const ALIAS_RESOLUTION_NOT_FOUND_MESSAGE =
  'The requested alias resolution was not found';
export const ALIAS_RESOLUTION_NOT_FOUND_MESSAGE_KEY: ErrorMessageKey =
  'errors.migration.aliasResolutionNotFound';
export const COMPARISON_NOT_FOUND_MESSAGE =
  'The requested formula comparison was not found';
export const COMPARISON_NOT_FOUND_MESSAGE_KEY: ErrorMessageKey =
  'errors.migration.comparisonNotFound';
export const MIGRATION_SCOPE_NOT_FOUND_MESSAGE =
  'The team or member scope was not found';
export const MIGRATION_SCOPE_NOT_FOUND_MESSAGE_KEY: ErrorMessageKey =
  'errors.migration.scopeNotFound';
export const MIGRATION_VALIDATION_MESSAGE =
  'The migration request failed a domain validation rule';
export const MIGRATION_VALIDATION_MESSAGE_KEY: ErrorMessageKey =
  'errors.migration.validation';
export const IMPORT_NOT_COMMITTABLE_MESSAGE =
  'The import job cannot be committed in its current state';
export const IMPORT_NOT_COMMITTABLE_MESSAGE_KEY: ErrorMessageKey =
  'errors.migration.importNotCommittable';
export const IMPORT_NOT_REVERSIBLE_MESSAGE =
  'The import job cannot be reversed in its current state';
export const IMPORT_NOT_REVERSIBLE_MESSAGE_KEY: ErrorMessageKey =
  'errors.migration.importNotReversible';
export const ALIAS_COLLISION_MESSAGE =
  'This alias would map to a second active player without an explicit override';
export const ALIAS_COLLISION_MESSAGE_KEY: ErrorMessageKey =
  'errors.migration.aliasCollision';
export const MIGRATION_VERSION_CONFLICT_MESSAGE =
  'The record was modified concurrently';
export const MIGRATION_VERSION_CONFLICT_MESSAGE_KEY: ErrorMessageKey =
  'errors.migration.versionConflict';

// --- Audit / events ----------------------------------------------------------

export const IMPORT_RESOURCE_TYPE = 'import_job';
export const ALIAS_RESOURCE_TYPE = 'alias_resolution';
export const COMPARISON_RESOURCE_TYPE = 'formula_comparison';

export const IMPORT_STAGED_ACTION = 'migration.import.staged';
export const IMPORT_COMMITTED_ACTION = 'migration.import.committed';
export const IMPORT_REVERSED_ACTION = 'migration.import.reversed';
export const ALIAS_REVIEWED_ACTION = 'migration.alias.reviewed';
export const COMPARISON_SIGNED_ACTION = 'migration.comparison.signed';

// --- Static column lists (never SELECT *) ------------------------------------

export const IMPORT_JOB_COLUMNS = `"id", "team_id", "season_id",
  "workbook_type", "mapper_version", "source_hash", "source_name", "dry_run",
  "status", "received_rows", "staged_rows", "committed_rows", "skipped_rows",
  "error_rows", "quarantined_rows", "reversal_of_job_id", "record_version",
  "requested_by", "committed_at", "reversed_at", "created_at", "updated_at"`;

export const ROW_RESULT_COLUMNS = `"id", "team_id", "job_id", "row_ref",
  "outcome", "action", "entity_ref", "message_key", "created_at"`;

export const ALIAS_RESOLUTION_COLUMNS = `"id", "team_id", "source",
  "source_alias", "normalized_alias", "candidate_membership_id", "confidence",
  "status", "resolved_membership_id", "override", "record_version",
  "reviewed_by", "reviewed_at", "created_at", "updated_at"`;

export const COMPARISON_COLUMNS = `"id", "team_id", "workbook_type", "metric",
  "subject_ref", "legacy_value", "target_value", "difference",
  "classification", "legacy_rule_version", "target_rule_version",
  "artifact_checksum", "signed_off", "signed_off_by_name", "record_version",
  "signed_off_at", "created_at", "updated_at"`;

/**
 * Idempotent comparison upsert keyed by (workbook, metric, subject): re-running
 * a comparison converges on the same row and clears any prior sign-off, because
 * a recomputed number must be re-approved rather than inheriting stale approval.
 */
export const COMPARISON_UPSERT_SQL = `INSERT INTO "formula_comparisons"
    ("id", "team_id", "workbook_type", "metric", "subject_ref",
     "legacy_value", "target_value", "difference", "classification",
     "legacy_rule_version", "target_rule_version", "artifact_checksum",
     "created_at", "updated_at")
   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $13)
   ON CONFLICT ("team_id", "workbook_type", "metric", "subject_ref")
   DO UPDATE SET
     "legacy_value" = EXCLUDED."legacy_value",
     "target_value" = EXCLUDED."target_value",
     "difference" = EXCLUDED."difference",
     "classification" = EXCLUDED."classification",
     "legacy_rule_version" = EXCLUDED."legacy_rule_version",
     "target_rule_version" = EXCLUDED."target_rule_version",
     "artifact_checksum" = EXCLUDED."artifact_checksum",
     "signed_off" = false, "signed_off_by_name" = NULL,
     "signed_off_at" = NULL,
     "updated_at" = EXCLUDED."updated_at"
   RETURNING ${COMPARISON_COLUMNS}`;
