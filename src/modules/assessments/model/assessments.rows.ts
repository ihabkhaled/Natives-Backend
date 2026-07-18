export interface CountRow {
  readonly count: number;
}

export interface IdRow {
  readonly id: string;
}

export interface CategoryRow {
  readonly id: string;
  readonly category_key: string;
  readonly name: string;
  readonly description: string;
  readonly sort_order: number;
  readonly status: string;
  readonly version: number;
  readonly created_at: string | Date;
}

export interface ScaleRow {
  readonly id: string;
  readonly scale_key: string;
  readonly name: string;
  readonly value_kind: string;
  readonly unit: string | null;
  readonly minimum_value: string | null;
  readonly maximum_value: string | null;
  readonly step_value: string | null;
  readonly categorical_options: readonly string[];
  readonly guidance: string;
  readonly status: string;
  readonly scale_version: number;
  readonly created_at: string | Date;
}

export interface MetricRow {
  readonly id: string;
  readonly family_id: string;
  readonly team_id: string | null;
  readonly category_id: string;
  readonly scale_id: string;
  readonly definition_key: string;
  readonly name: string;
  readonly definition: string;
  readonly direction: string;
  readonly guidance: string;
  readonly applicability: readonly string[];
  readonly tags: readonly string[];
  readonly status: string;
  readonly definition_version: number;
  readonly record_version: number;
  readonly created_by: string | null;
  readonly archived_by: string | null;
  readonly created_at: string | Date;
  readonly archived_at: string | Date | null;
}

export interface TemplateRow {
  readonly id: string;
  readonly family_id: string;
  readonly team_id: string;
  readonly season_id: string | null;
  readonly template_key: string;
  readonly name: string;
  readonly cohort: string | null;
  readonly evaluator_roles: readonly string[];
  readonly score_version: number;
  readonly status: string;
  readonly template_version: number;
  readonly record_version: number;
  readonly published_at: string | Date | null;
  readonly published_by: string | null;
  readonly created_by: string | null;
  readonly created_at: string | Date;
}

export interface CategoryWeightRow {
  readonly template_id: string;
  readonly category_id: string;
  readonly weight_percentage: number;
}

export interface TemplateMetricRow {
  readonly template_id: string;
  readonly metric_definition_id: string;
  readonly required: boolean;
  readonly sort_order: number;
}

export interface PeriodRow {
  readonly id: string;
  readonly team_id: string;
  readonly season_id: string | null;
  readonly template_id: string;
  readonly name: string;
  readonly cohort: string | null;
  readonly starts_on: string;
  readonly ends_on: string;
  readonly status: string;
  readonly record_version: number;
  readonly created_by: string | null;
  readonly created_at: string | Date;
}
