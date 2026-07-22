import type {
  AnalyticsDimension,
  AnalyticsDirection,
  AnalyticsPeriodType,
  AnalyticsSubjectType,
  AnalyticsUnit,
} from './analytics.enums';

// --- Pagination --------------------------------------------------------------

export interface PageRequest {
  readonly limit: number;
  readonly offset: number;
}

// --- Projections -------------------------------------------------------------

/**
 * One governed read-model row. `value` is nullable: "not evaluated" is NULL,
 * never zero, so a series shows a gap. `sampleSize` records how many facts the
 * value was derived from, which is how a small cohort is suppressed.
 */
export interface AnalyticsProjection {
  readonly projectionId: string;
  readonly teamId: string;
  readonly seasonId: string | null;
  readonly subjectType: AnalyticsSubjectType;
  readonly subjectId: string | null;
  readonly dimension: AnalyticsDimension;
  readonly periodType: AnalyticsPeriodType;
  readonly periodKey: string;
  readonly value: number | null;
  readonly sampleSize: number;
  readonly unit: AnalyticsUnit;
  readonly direction: AnalyticsDirection;
  readonly calculationVersion: string;
  readonly sourceCoverage: Readonly<Record<string, number>>;
  readonly computedAt: Date;
}

/** A fully-resolved projection ready for its idempotent upsert. */
export interface ProjectionUpsert {
  readonly id: string;
  readonly teamId: string;
  readonly seasonId: string | null;
  readonly subjectType: AnalyticsSubjectType;
  readonly subjectId: string | null;
  readonly dimension: AnalyticsDimension;
  readonly periodType: AnalyticsPeriodType;
  readonly periodKey: string;
  readonly value: number | null;
  readonly sampleSize: number;
  readonly unit: AnalyticsUnit;
  readonly direction: AnalyticsDirection;
  readonly calculationVersion: string;
  readonly sourceCoverage: Readonly<Record<string, number>>;
  readonly now: Date;
}

// --- Facts (pure inputs) -----------------------------------------------------

/** One member's counted attendance in a period. */
export interface AttendanceFact {
  readonly membershipId: string;
  readonly periodKey: string;
  readonly attended: number;
  readonly total: number;
}

/** One member's counted points in a period. */
export interface PointsFact {
  readonly membershipId: string;
  readonly periodKey: string;
  readonly total: number;
}

/** The measured attendance ratio for a member, or null when nothing recorded. */
export interface AttendanceMeasure {
  readonly membershipId: string;
  readonly periodKey: string;
  readonly ratio: number | null;
  readonly sampleSize: number;
}

// --- Series (chart-ready) ----------------------------------------------------

/** One point of a chart-ready series. A null value is an honest gap. */
export interface SeriesPoint {
  readonly periodKey: string;
  readonly value: number | null;
  readonly sampleSize: number;
}

/**
 * A chart-ready series: a stable id, its unit, direction, and null-gap points,
 * plus a benchmark label and an accessible textual summary.
 */
export interface AnalyticsSeries {
  readonly seriesId: string;
  readonly dimension: AnalyticsDimension;
  readonly unit: AnalyticsUnit;
  readonly direction: AnalyticsDirection;
  readonly periodType: AnalyticsPeriodType;
  readonly calculationVersion: string;
  readonly benchmarkLabel: string;
  readonly summary: string;
  readonly points: readonly SeriesPoint[];
  readonly computedAt: Date | null;
}

export interface SeriesQuery {
  readonly dimension: AnalyticsDimension;
  readonly periodType: AnalyticsPeriodType;
}

export interface SeriesQueryInput {
  readonly dimension?: AnalyticsDimension | null;
  readonly periodType?: AnalyticsPeriodType | null;
}

// --- Cohort comparison -------------------------------------------------------

export interface CohortComparisonQuery {
  readonly dimension: AnalyticsDimension;
  readonly periodType: AnalyticsPeriodType;
  readonly periodKey: string;
}

export interface CohortComparisonQueryInput {
  readonly dimension: AnalyticsDimension;
  readonly periodType?: AnalyticsPeriodType | null;
  readonly periodKey: string;
}

/**
 * A privacy-safe cohort comparison. Only aggregate statistics are exposed, and
 * only when the cohort meets the privacy threshold — otherwise `suppressed` is
 * true and the statistics are null.
 */
export interface CohortComparison {
  readonly dimension: AnalyticsDimension;
  readonly periodKey: string;
  readonly sampleSize: number;
  readonly suppressed: boolean;
  readonly average: number | null;
  readonly minimum: number | null;
  readonly maximum: number | null;
}

// --- Rebuild -----------------------------------------------------------------

export interface RebuildCommand {
  readonly seasonId: string | null;
  readonly periodType: AnalyticsPeriodType;
}

/** The reconciliation of one rebuild run. */
export interface RebuildReport {
  readonly seasonId: string | null;
  readonly periodType: AnalyticsPeriodType;
  readonly calculationVersion: string;
  readonly subjectsProjected: number;
  readonly projectionsWritten: number;
  readonly computedAt: Date;
}

/** The resolved team/season scope of an analytics operation. */
export interface AnalyticsScope {
  readonly teamId: string;
  readonly seasonId: string | null;
}
