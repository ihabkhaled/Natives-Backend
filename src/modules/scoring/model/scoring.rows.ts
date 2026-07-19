/** Raw `calculation_rules` row as returned by the database driver. */
export interface CalculationRuleRow {
  readonly id: string;
  readonly team_id: string | null;
  readonly season_id: string | null;
  readonly rule_key: string;
  readonly version: number;
  readonly name: string;
  readonly description: string | null;
  readonly status: string;
  readonly scale_min: string;
  readonly scale_max: string;
  readonly min_components: number;
  readonly components: unknown;
  readonly effective_from: string | null;
  readonly effective_to: string | null;
  readonly record_version: number;
  readonly created_by: string | null;
  readonly published_by: string | null;
  readonly published_at: string | Date | null;
  readonly retired_at: string | Date | null;
  readonly created_at: string | Date;
  readonly updated_at: string | Date;
}

/** Raw `performance_score_projections` row. */
export interface ScoreProjectionRow {
  readonly id: string;
  readonly team_id: string;
  readonly season_id: string | null;
  readonly membership_id: string;
  readonly period_id: string | null;
  readonly rule_id: string;
  readonly rule_key: string;
  readonly rule_version: number;
  readonly status: string;
  readonly overall_value: string | null;
  readonly overall_numerator: string | null;
  readonly overall_denominator: string | null;
  readonly included_count: number;
  readonly excluded_count: number;
  readonly completeness: string;
  readonly confidence: string;
  readonly explanation: unknown;
  readonly source_hash: string | null;
  readonly error: string | null;
  readonly computed_at: string | Date | null;
  readonly created_at: string | Date;
  readonly updated_at: string | Date;
}

/**
 * One aggregated source row: the non-null assessed metric values of a single
 * membership+category from published assessments, plus the total metric count so
 * missing (excluded) observations can be reported without inferring zero.
 */
export interface CategorySourceRow {
  readonly membership_id: string;
  readonly category_key: string;
  readonly values: readonly (string | number)[];
  readonly total_metrics: number;
}

/** A membership id surfaced for a projection rebuild scan. */
export interface MembershipRow {
  readonly membership_id: string;
}

/** A generic count row. */
export interface CountRow {
  readonly count: number;
}

/** A single-column id probe row for existence checks. */
export interface IdRow {
  readonly id: string;
}
