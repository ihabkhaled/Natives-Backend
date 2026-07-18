import type { PlayerAssessmentStatus } from '../model/player-assessments.enums';
import { PLAYER_ASSESSMENT_STATUS_VALUES } from '../model/player-assessments.enums';
import type {
  ContextHeadRow,
  PlayerAssessmentRow,
  PlayerAssessmentValueRow,
  TemplateMetricBoundRow,
} from '../model/player-assessments.rows';
import type {
  PlayerAssessment,
  PlayerAssessmentContext,
  PlayerAssessmentSummary,
  PlayerAssessmentValue,
  PlayerPublishedAssessment,
  TemplateMetricBound,
} from '../model/player-assessments.types';

export function toPlayerAssessment(row: PlayerAssessmentRow): PlayerAssessment {
  return {
    id: row.id,
    familyId: row.family_id,
    teamId: row.team_id,
    seasonId: row.season_id,
    periodId: row.period_id,
    templateId: row.template_id,
    membershipId: row.membership_id,
    evaluatorUserId: row.evaluator_user_id,
    status: parseStatus(row.status),
    revision: row.revision,
    summary: row.summary,
    recordVersion: row.record_version,
    submittedAt: toNullableDate(row.submitted_at),
    submittedBy: row.submitted_by,
    reviewedAt: toNullableDate(row.reviewed_at),
    reviewedBy: row.reviewed_by,
    publishedAt: toNullableDate(row.published_at),
    publishedBy: row.published_by,
    supersededAt: toNullableDate(row.superseded_at),
    supersededById: row.superseded_by_id,
    createdBy: row.created_by,
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
  };
}

export function toPlayerAssessmentValue(
  row: PlayerAssessmentValueRow,
): PlayerAssessmentValue {
  return {
    metricDefinitionId: row.metric_definition_id,
    numericValue: toNullableNumber(row.numeric_value),
    textValue: row.text_value,
    note: row.note,
    confidence: row.confidence,
    observationCount: row.observation_count,
  };
}

export function toPlayerAssessmentSummary(
  row: PlayerAssessmentRow,
): PlayerAssessmentSummary {
  return {
    id: row.id,
    familyId: row.family_id,
    teamId: row.team_id,
    periodId: row.period_id,
    membershipId: row.membership_id,
    evaluatorUserId: row.evaluator_user_id,
    status: parseStatus(row.status),
    revision: row.revision,
    recordVersion: row.record_version,
    createdAt: toDate(row.created_at),
    publishedAt: toNullableDate(row.published_at),
  };
}

/** Shape a published assessment for the assessed player: private notes removed. */
export function toPlayerPublishedAssessment(
  assessment: PlayerAssessment,
  values: readonly PlayerAssessmentValue[],
): PlayerPublishedAssessment {
  return {
    id: assessment.id,
    teamId: assessment.teamId,
    periodId: assessment.periodId,
    templateId: assessment.templateId,
    membershipId: assessment.membershipId,
    status: assessment.status,
    revision: assessment.revision,
    summary: assessment.summary,
    publishedAt: assessment.publishedAt,
    values: values.map(value => ({
      metricDefinitionId: value.metricDefinitionId,
      numericValue: value.numericValue,
      textValue: value.textValue,
    })),
  };
}

export function toTemplateMetricBound(
  row: TemplateMetricBoundRow,
): TemplateMetricBound {
  return {
    metricDefinitionId: row.metric_definition_id,
    required: row.required,
    minimumValue: toNullableNumber(row.minimum_value),
    maximumValue: toNullableNumber(row.maximum_value),
  };
}

export function toPlayerAssessmentContext(
  head: ContextHeadRow,
  metrics: readonly TemplateMetricBoundRow[],
): PlayerAssessmentContext {
  return {
    templateId: head.template_id,
    seasonId: head.season_id,
    metrics: metrics.map(metric => toTemplateMetricBound(metric)),
  };
}

function parseStatus(raw: string): PlayerAssessmentStatus {
  return parseEnum(
    PLAYER_ASSESSMENT_STATUS_VALUES,
    raw,
    'player assessment status',
  );
}

function parseEnum<TValue extends string>(
  values: readonly TValue[],
  raw: string,
  label: string,
): TValue {
  const value = values.find(candidate => candidate === raw);
  if (value === undefined) {
    throw new Error(`Unrecognized ${label}: ${raw}`);
  }
  return value;
}

function toDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

function toNullableDate(value: string | Date | null): Date | null {
  return value === null ? null : toDate(value);
}

function toNullableNumber(value: string | null): number | null {
  return value === null ? null : Number(value);
}
