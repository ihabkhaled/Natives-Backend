import type { ErrorMessageKey } from '@core/errors/error.types';

import {
  AnalyticsDimension,
  AnalyticsDirection,
  AnalyticsUnit,
} from './analytics.enums';

// --- API surface -------------------------------------------------------------

export const ANALYTICS_API_TAG = 'analytics';
export const ANALYTICS_ROUTE = 'teams/:teamId/analytics';

export const TEAM_ID_PARAM = 'teamId';
export const SUBJECT_ID_PARAM = 'subjectId';

export const PLAYER_SERIES_ROUTE = 'players/:subjectId/series';
export const TEAM_SERIES_ROUTE = 'team/series';
export const COHORT_COMPARISON_ROUTE = 'cohorts/comparison';
export const REBUILD_ROUTE = 'rebuild';

// --- Pagination --------------------------------------------------------------

export const LIST_DEFAULT_LIMIT = 30;
export const LIST_MAX_LIMIT = 366;
export const LIST_MIN_LIMIT = 1;
export const LIST_DEFAULT_OFFSET = 0;
export const REBUILD_MAX_SUBJECTS = 500;

// --- Calculation / privacy ---------------------------------------------------

/** The named calculation version every projection cites. */
export const CALCULATION_VERSION = 'analytics-v1';

/**
 * The minimum sample size a COHORT comparison may be exposed at. A cohort below
 * this threshold is suppressed so a small group cannot enable a sensitive
 * inference about an individual.
 */
export const COHORT_PRIVACY_THRESHOLD = 5;

/** How long a projection is considered fresh before a rebuild is advised. */
export const FRESHNESS_STALE_HOURS = 24;
export const MILLISECONDS_PER_HOUR = 3_600_000;

// --- Field bounds ------------------------------------------------------------

export const PERIOD_KEY_MAX_LENGTH = 20;

// --- Dimension metadata (unit + direction) -----------------------------------

/** The unit each dimension is measured in. */
export const DIMENSION_UNITS: ReadonlyMap<AnalyticsDimension, AnalyticsUnit> =
  new Map([
    [AnalyticsDimension.Attendance, AnalyticsUnit.Ratio],
    [AnalyticsDimension.Consistency, AnalyticsUnit.Ratio],
    [AnalyticsDimension.Points, AnalyticsUnit.Points],
    [AnalyticsDimension.Overall, AnalyticsUnit.Score],
    [AnalyticsDimension.RosterCoverage, AnalyticsUnit.Ratio],
    [AnalyticsDimension.TrainingVolume, AnalyticsUnit.Count],
    [AnalyticsDimension.AssessmentCoverage, AnalyticsUnit.Ratio],
    [AnalyticsDimension.MatchInvolvement, AnalyticsUnit.Count],
  ]);

/** Whether a higher value is better for each dimension. */
export const DIMENSION_DIRECTIONS: ReadonlyMap<
  AnalyticsDimension,
  AnalyticsDirection
> = new Map([
  [AnalyticsDimension.Attendance, AnalyticsDirection.HigherBetter],
  [AnalyticsDimension.Consistency, AnalyticsDirection.HigherBetter],
  [AnalyticsDimension.Points, AnalyticsDirection.HigherBetter],
  [AnalyticsDimension.Overall, AnalyticsDirection.HigherBetter],
  [AnalyticsDimension.RosterCoverage, AnalyticsDirection.HigherBetter],
  [AnalyticsDimension.AssessmentCoverage, AnalyticsDirection.HigherBetter],
]);

// --- Error messages ----------------------------------------------------------

export const ANALYTICS_SCOPE_NOT_FOUND_MESSAGE =
  'The team, season, or subject scope was not found';
export const ANALYTICS_SCOPE_NOT_FOUND_MESSAGE_KEY: ErrorMessageKey =
  'errors.analytics.scopeNotFound';
export const ANALYTICS_VALIDATION_MESSAGE =
  'The analytics request failed a domain validation rule';
export const ANALYTICS_VALIDATION_MESSAGE_KEY: ErrorMessageKey =
  'errors.analytics.validation';
export const COHORT_TOO_SMALL_MESSAGE =
  'The cohort is too small to compare without risking a sensitive inference';
export const COHORT_TOO_SMALL_MESSAGE_KEY: ErrorMessageKey =
  'errors.analytics.cohortTooSmall';

// --- Audit / events ----------------------------------------------------------

export const PROJECTION_RESOURCE_TYPE = 'analytics_projection';
export const ANALYTICS_REBUILT_ACTION = 'analytics.rebuilt';

// --- Static column lists (never SELECT *) ------------------------------------

export const PROJECTION_COLUMNS = `"id", "team_id", "season_id", "subject_type",
  "subject_id", "dimension", "period_type", "period_key", "value",
  "sample_size", "unit", "direction", "calculation_version", "source_coverage",
  "computed_at", "created_at", "updated_at"`;

/**
 * Idempotent projection upsert keyed by (team, season, subject, dimension,
 * period), so a full rebuild converges on the same read model rather than
 * accumulating duplicate rows.
 */
export const PROJECTION_UPSERT_SQL = `INSERT INTO "analytics_projections"
    ("id", "team_id", "season_id", "subject_type", "subject_id",
     "dimension", "period_type", "period_key", "value", "sample_size",
     "unit", "direction", "calculation_version", "source_coverage",
     "computed_at", "created_at", "updated_at")
   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
           $14::jsonb, $15, $15, $15)
   ON CONFLICT ("team_id",
     COALESCE("season_id", '00000000-0000-0000-0000-000000000000'::uuid),
     "subject_type",
     COALESCE("subject_id", '00000000-0000-0000-0000-000000000000'::uuid),
     "dimension", "period_type", "period_key")
   DO UPDATE SET
     "value" = EXCLUDED."value",
     "sample_size" = EXCLUDED."sample_size",
     "unit" = EXCLUDED."unit",
     "direction" = EXCLUDED."direction",
     "calculation_version" = EXCLUDED."calculation_version",
     "source_coverage" = EXCLUDED."source_coverage",
     "computed_at" = EXCLUDED."computed_at",
     "updated_at" = EXCLUDED."updated_at"
   RETURNING ${PROJECTION_COLUMNS}`;
