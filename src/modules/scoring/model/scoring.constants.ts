import type { ErrorMessageKey } from '@core/errors/error.types';

import { ScoreCategory } from './scoring.enums';
import type { RuleComponent } from './scoring.types';

// --- API surface -------------------------------------------------------------

export const SCORING_API_TAG = 'scoring';
export const CALCULATION_RULES_ROUTE = 'teams/:teamId/calculation-rules';
export const PERFORMANCE_SCORES_ROUTE = 'teams/:teamId/performance-scores';
export const MY_PERFORMANCE_SCORE_ROUTE = 'teams/:teamId/my-performance-score';

export const TEAM_ID_PARAM = 'teamId';
export const RULE_ID_PARAM = 'ruleId';
export const MEMBERSHIP_ID_PARAM = 'membershipId';

export const RULE_DETAIL_ROUTE = ':ruleId';
export const RULE_TRANSITION_ROUTE = ':ruleId/transition';
export const RULE_SIMULATE_ROUTE = ':ruleId/simulate';
export const SCORE_REBUILD_ROUTE = 'rebuild';
export const SCORE_MEMBER_ROUTE = ':membershipId';

// --- Pagination --------------------------------------------------------------

export const LIST_DEFAULT_LIMIT = 20;
export const LIST_MAX_LIMIT = 100;
export const LIST_MIN_LIMIT = 1;
export const LIST_DEFAULT_OFFSET = 0;
export const REBUILD_SCAN_MAX = 1000;

// --- Rule bounds -------------------------------------------------------------

export const RULE_KEY_MIN_LENGTH = 2;
export const RULE_KEY_MAX_LENGTH = 100;
export const RULE_NAME_MIN_LENGTH = 2;
export const RULE_NAME_MAX_LENGTH = 200;
export const RULE_DESCRIPTION_MAX_LENGTH = 2000;
export const RULE_COMPONENTS_MIN_ITEMS = 1;
export const RULE_COMPONENTS_MAX_ITEMS = 20;
export const COMPONENT_WEIGHT_MIN = 0.000_001;
export const COMPONENT_WEIGHT_MAX = 1000;
export const COMPONENT_MIN_SAMPLE_MIN = 0;
export const COMPONENT_MIN_SAMPLE_MAX = 1000;
export const MIN_COMPONENTS_FLOOR = 1;
export const SCALE_MIN_FLOOR = 0;
export const SCALE_MAX_CEILING = 1000;
export const RECORD_VERSION_MIN = 1;
export const FIRST_RULE_VERSION = 1;

/** Default legacy 0–5 assessment scale for the seeded candidate rule. */
export const DEFAULT_SCALE_MIN = 0;
export const DEFAULT_SCALE_MAX = 5;

/** Display precision — rounding happens only at the presentation boundary. */
export const SCORE_DISPLAY_DECIMALS = 2;
export const COMPLETENESS_DISPLAY_DECIMALS = 4;

/** ISO date-only (YYYY-MM-DD) — rule effective windows are calendar days. */
export const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;

// --- Confidence thresholds (completeness fraction) ---------------------------

export const CONFIDENCE_HIGH_THRESHOLD = 0.8;
export const CONFIDENCE_MEDIUM_THRESHOLD = 0.5;

// --- Seeded legacy candidate rule -------------------------------------------

/** Stable id of the seeded legacy equal-weight overall candidate (a DRAFT). */
export const LEGACY_RULE_ID = '30300000-0000-4000-9000-000000000001';
export const LEGACY_RULE_KEY = 'legacy_overall';
export const LEGACY_RULE_NAME = 'Legacy equal-weight overall';
export const LEGACY_RULE_DESCRIPTION =
  'Equal-weight mean of Training, Technical, Tactical, Physical, ' +
  'Psychological, Behavioral, and Attendance. Seeded as a DRAFT candidate — ' +
  'never activated automatically; an administrator must approve and publish it.';
export const LEGACY_RULE_WEIGHT = 1;
export const LEGACY_RULE_MIN_SAMPLE = 1;
export const LEGACY_RULE_MIN_COMPONENTS = 1;

/** The seven legacy categories carried by the equal-weight candidate rule. */
export const LEGACY_RULE_CATEGORIES: readonly ScoreCategory[] = [
  ScoreCategory.Training,
  ScoreCategory.Technical,
  ScoreCategory.Tactical,
  ScoreCategory.Physical,
  ScoreCategory.Psychological,
  ScoreCategory.Behavioral,
  ScoreCategory.Attendance,
];

export const LEGACY_RULE_COMPONENTS: readonly RuleComponent[] =
  LEGACY_RULE_CATEGORIES.map(categoryKey => ({
    categoryKey,
    weight: LEGACY_RULE_WEIGHT,
    minSample: LEGACY_RULE_MIN_SAMPLE,
  }));

/** Category keys sourced from published assessments (all but attendance). */
export const ASSESSMENT_SOURCED_CATEGORIES: readonly ScoreCategory[] = [
  ScoreCategory.Training,
  ScoreCategory.Technical,
  ScoreCategory.Tactical,
  ScoreCategory.Physical,
  ScoreCategory.Psychological,
  ScoreCategory.Behavioral,
];

// --- Attendance sourcing -----------------------------------------------------

/**
 * Legacy CANDIDATE session-type weights and penalties (11-SCHEMAS
 * legacy-business-rules.yaml). Data, not final policy — supplied to the pure
 * weighted-attendance calculator and golden-tested; never adopted automatically.
 */
export const LEGACY_ATTENDANCE_WEIGHTS = {
  practice: 3,
  fitness: 2,
  game: 3,
  throwing: 4,
  latePenalty: 1,
  absentPenalty: 1,
} as const;

/**
 * The attendance percentage (0–1) is normalized onto the shared 0–5 observation
 * scale so it sits alongside assessment category means in the weighted overall:
 * 100% attendance reads as 5.0.
 */
export const ATTENDANCE_NORMALIZED_MAX = 5;

/** Attendance record statuses (module 202) counted as attended (present-like). */
export const ATTENDED_STATUSES: readonly string[] = [
  'present_on_time',
  'present_late',
  'remote_approved',
  'other_approved',
];

/** Attendance statuses excused/injured — excluded from the denominator. */
export const EXCUSED_STATUSES: readonly string[] = ['excused', 'injured'];

/** The absent attendance status. */
export const ABSENT_STATUS = 'absent';

/** Attendance-sheet states whose records are final enough to score. */
export const SCORABLE_SHEET_STATES: readonly string[] = [
  'finalized',
  'corrected',
];

export const EXCLUDED_MISSING_REASON = 'no assessed data for this category';
export const EXCLUDED_ZERO_WEIGHT_REASON = 'component weight is not positive';
export const INSUFFICIENT_DATA_REASON =
  'fewer present components than the rule minimum';

// --- Error messages ----------------------------------------------------------

export const RULE_NOT_FOUND_MESSAGE =
  'The requested calculation rule was not found';
export const RULE_NOT_FOUND_MESSAGE_KEY: ErrorMessageKey =
  'errors.scoring.ruleNotFound';
export const RULE_INVALID_TRANSITION_MESSAGE =
  'The calculation rule cannot make this lifecycle transition';
export const RULE_INVALID_TRANSITION_MESSAGE_KEY: ErrorMessageKey =
  'errors.scoring.ruleInvalidTransition';
export const RULE_VERSION_CONFLICT_MESSAGE =
  'The calculation rule was modified concurrently';
export const RULE_VERSION_CONFLICT_MESSAGE_KEY: ErrorMessageKey =
  'errors.scoring.ruleVersionConflict';
export const RULE_NOT_EDITABLE_MESSAGE =
  'Only a draft calculation rule can be edited';
export const RULE_NOT_EDITABLE_MESSAGE_KEY: ErrorMessageKey =
  'errors.scoring.ruleNotEditable';
export const SCORING_VALIDATION_MESSAGE =
  'The scoring request failed a domain validation rule';
export const SCORING_VALIDATION_MESSAGE_KEY: ErrorMessageKey =
  'errors.scoring.validation';
export const SCORING_SCOPE_NOT_FOUND_MESSAGE =
  'The team, season, or membership scope was not found';
export const SCORING_SCOPE_NOT_FOUND_MESSAGE_KEY: ErrorMessageKey =
  'errors.scoring.scopeNotFound';
export const PROJECTION_NOT_FOUND_MESSAGE =
  'No performance score projection was found';
export const PROJECTION_NOT_FOUND_MESSAGE_KEY: ErrorMessageKey =
  'errors.scoring.projectionNotFound';

// --- Audit actions / resources ----------------------------------------------

export const RULE_RESOURCE_TYPE = 'calculation_rule';
export const RULE_AGGREGATE = 'calculation_rule';
export const PROJECTION_AGGREGATE = 'performance_score_projection';
export const RULE_CREATED_ACTION = 'scoring.rule.created';
export const RULE_UPDATED_ACTION = 'scoring.rule.updated';
export const RULE_TRANSITIONED_ACTION = 'scoring.rule.transitioned';
export const PROJECTION_REBUILT_ACTION = 'scoring.projection.rebuilt';

// --- Domain events (past-tense, versioned, privacy-safe payloads) ------------

export const SCORING_EVENT_VERSION = 1;
export const RULE_CREATED_EVENT = 'scoring.rule.created.v1';
export const RULE_PUBLISHED_EVENT = 'scoring.rule.published.v1';
export const RULE_RETIRED_EVENT = 'scoring.rule.retired.v1';
export const PROJECTION_REQUESTED_EVENT = 'scoring.projection.requested.v1';
export const PROJECTION_REBUILT_EVENT = 'scoring.projection.rebuilt.v1';

// --- Static column lists (never SELECT *) ------------------------------------

export const CALCULATION_RULE_COLUMNS = `"id", "team_id", "season_id", "rule_key",
  "version", "name", "description", "status", "scale_min", "scale_max",
  "min_components", "components", "effective_from", "effective_to",
  "record_version", "created_by", "published_by", "published_at", "retired_at",
  "created_at", "updated_at"`;

export const SCORE_PROJECTION_COLUMNS = `"id", "team_id", "season_id",
  "membership_id", "period_id", "rule_id", "rule_key", "rule_version", "status",
  "overall_value", "overall_numerator", "overall_denominator", "included_count",
  "excluded_count", "completeness", "confidence", "explanation", "source_hash",
  "error", "computed_at", "created_at", "updated_at"`;
