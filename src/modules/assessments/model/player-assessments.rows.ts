export interface PlayerAssessmentRow {
  readonly id: string;
  readonly family_id: string;
  readonly team_id: string;
  readonly season_id: string | null;
  readonly period_id: string;
  readonly template_id: string;
  readonly membership_id: string;
  readonly evaluator_user_id: string;
  readonly status: string;
  readonly revision: number;
  readonly summary: string | null;
  readonly record_version: number;
  readonly submitted_at: string | Date | null;
  readonly submitted_by: string | null;
  readonly reviewed_at: string | Date | null;
  readonly reviewed_by: string | null;
  readonly published_at: string | Date | null;
  readonly published_by: string | null;
  readonly superseded_at: string | Date | null;
  readonly superseded_by_id: string | null;
  readonly created_by: string | null;
  readonly created_at: string | Date;
  readonly updated_at: string | Date;
}

export interface PlayerAssessmentValueRow {
  readonly id: string;
  readonly assessment_id: string;
  readonly metric_definition_id: string;
  readonly numeric_value: string | null;
  readonly text_value: string | null;
  readonly note: string | null;
  readonly confidence: number | null;
  readonly observation_count: number | null;
  readonly created_at: string | Date;
}

export interface TemplateMetricBoundRow {
  readonly metric_definition_id: string;
  readonly required: boolean;
  readonly minimum_value: string | null;
  readonly maximum_value: string | null;
}

export interface ContextHeadRow {
  readonly template_id: string;
  readonly season_id: string | null;
}
