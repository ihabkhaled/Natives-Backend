/** Raw `analytics_projections` row. */
export interface ProjectionRow {
  readonly id: string;
  readonly team_id: string;
  readonly season_id: string | null;
  readonly subject_type: string;
  readonly subject_id: string | null;
  readonly dimension: string;
  readonly period_type: string;
  readonly period_key: string;
  readonly value: number | string | null;
  readonly sample_size: number | string;
  readonly unit: string;
  readonly direction: string;
  readonly calculation_version: string;
  readonly source_coverage: unknown;
  readonly computed_at: string | Date;
  readonly created_at: string | Date;
  readonly updated_at: string | Date;
}

/**
 * One aggregated attendance fact per member per period. `attended` and `total`
 * are counts; a member with a total of zero contributed nothing but is still a
 * row, so completeness counts zero-contribution participants.
 */
export interface AttendanceFactRow {
  readonly membership_id: string;
  readonly period_key: string;
  readonly attended: number | string;
  readonly total: number | string;
}

/** One aggregated points fact per member per period. */
export interface PointsFactRow {
  readonly membership_id: string;
  readonly period_key: string;
  readonly total: number | string;
}

/** The roster of members in scope, so zero-contribution players still appear. */
export interface MembershipFactRow {
  readonly membership_id: string;
}

/** A generic count row. */
export interface AnalyticsCountRow {
  readonly count: number | string;
}

/** A single-column id probe row. */
export interface AnalyticsIdRow {
  readonly id: string;
}
