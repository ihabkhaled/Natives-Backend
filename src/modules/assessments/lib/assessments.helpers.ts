import { LIST_DEFAULT_LIMIT, LIST_DEFAULT_OFFSET, LIST_MAX_LIMIT } from '../model/assessments.constants';
import {
  AssessmentDirection,
  ASSESSMENT_DIRECTION_VALUES,
  AssessmentScaleKind,
  ASSESSMENT_SCALE_KIND_VALUES,
  AssessmentStatus,
  ASSESSMENT_STATUS_VALUES,
  AssessmentTemplateStatus,
  ASSESSMENT_TEMPLATE_STATUS_VALUES,
} from '../model/assessments.enums';
import type {
  CategoryRow,
  CategoryWeightRow,
  MetricRow,
  PeriodRow,
  ScaleRow,
  TemplateMetricRow,
  TemplateRow,
} from '../model/assessments.rows';
import type {
  AssessmentCategory,
  AssessmentMetric,
  AssessmentPeriod,
  AssessmentScale,
  AssessmentTemplate,
  CategoryWeightInput,
  PageRequest,
  TemplateMetricInput,
} from '../model/assessments.types';
import { RbacRole, RBAC_ROLE_VALUES } from '@shared/enums';

export function resolveAssessmentPage(
  limit: number | undefined,
  offset: number | undefined,
): PageRequest {
  return {
    limit: Math.min(limit ?? LIST_DEFAULT_LIMIT, LIST_MAX_LIMIT),
    offset: offset ?? LIST_DEFAULT_OFFSET,
  };
}

export function toAssessmentCategory(row: CategoryRow): AssessmentCategory {
  return {
    id: row.id,
    key: row.category_key,
    name: row.name,
    description: row.description,
    sortOrder: row.sort_order,
    status: parseAssessmentStatus(row.status),
    version: row.version,
    createdAt: toDate(row.created_at),
  };
}

export function toAssessmentScale(row: ScaleRow): AssessmentScale {
  return {
    id: row.id,
    key: row.scale_key,
    name: row.name,
    valueKind: parseScaleKind(row.value_kind),
    unit: row.unit,
    minimumValue: toNullableNumber(row.minimum_value),
    maximumValue: toNullableNumber(row.maximum_value),
    stepValue: toNullableNumber(row.step_value),
    categoricalOptions: row.categorical_options,
    guidance: row.guidance,
    status: parseAssessmentStatus(row.status),
    version: row.scale_version,
    createdAt: toDate(row.created_at),
  };
}

export function toAssessmentMetric(row: MetricRow): AssessmentMetric {
  return {
    id: row.id,
    familyId: row.family_id,
    teamId: row.team_id,
    categoryId: row.category_id,
    scaleId: row.scale_id,
    key: row.definition_key,
    name: row.name,
    definition: row.definition,
    direction: parseDirection(row.direction),
    guidance: row.guidance,
    applicability: row.applicability,
    tags: row.tags,
    status: parseAssessmentStatus(row.status),
    version: row.definition_version,
    recordVersion: row.record_version,
    createdBy: row.created_by,
    archivedBy: row.archived_by,
    createdAt: toDate(row.created_at),
    archivedAt: toNullableDate(row.archived_at),
  };
}

export function toAssessmentTemplate(
  row: TemplateRow,
  weights: readonly CategoryWeightRow[],
  metrics: readonly TemplateMetricRow[],
): AssessmentTemplate {
  return {
    id: row.id,
    familyId: row.family_id,
    teamId: row.team_id,
    seasonId: row.season_id,
    key: row.template_key,
    name: row.name,
    cohort: row.cohort,
    evaluatorRoles: row.evaluator_roles.map(parseRbacRole),
    scoreVersion: row.score_version,
    status: parseTemplateStatus(row.status),
    version: row.template_version,
    recordVersion: row.record_version,
    publishedAt: toNullableDate(row.published_at),
    publishedBy: row.published_by,
    createdBy: row.created_by,
    createdAt: toDate(row.created_at),
    categoryWeights: toCategoryWeights(row.id, weights),
    metrics: toTemplateMetrics(row.id, metrics),
  };
}

export function toAssessmentPeriod(row: PeriodRow): AssessmentPeriod {
  return {
    id: row.id,
    teamId: row.team_id,
    seasonId: row.season_id,
    templateId: row.template_id,
    name: row.name,
    cohort: row.cohort,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    status: parseAssessmentStatus(row.status),
    recordVersion: row.record_version,
    createdBy: row.created_by,
    createdAt: toDate(row.created_at),
  };
}

function toCategoryWeights(
  templateId: string,
  rows: readonly CategoryWeightRow[],
): readonly CategoryWeightInput[] {
  return rows
    .filter(row => row.template_id === templateId)
    .map(row => ({
      categoryId: row.category_id,
      weightPercentage: row.weight_percentage,
    }));
}

function toTemplateMetrics(
  templateId: string,
  rows: readonly TemplateMetricRow[],
): readonly TemplateMetricInput[] {
  return rows
    .filter(row => row.template_id === templateId)
    .map(row => ({
      metricDefinitionId: row.metric_definition_id,
      required: row.required,
      sortOrder: row.sort_order,
    }));
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

function parseAssessmentStatus(raw: string): AssessmentStatus {
  return parseEnum(ASSESSMENT_STATUS_VALUES, raw, 'assessment status');
}

function parseTemplateStatus(raw: string): AssessmentTemplateStatus {
  return parseEnum(
    ASSESSMENT_TEMPLATE_STATUS_VALUES,
    raw,
    'assessment template status',
  );
}

function parseDirection(raw: string): AssessmentDirection {
  return parseEnum(ASSESSMENT_DIRECTION_VALUES, raw, 'assessment direction');
}

function parseScaleKind(raw: string): AssessmentScaleKind {
  return parseEnum(ASSESSMENT_SCALE_KIND_VALUES, raw, 'assessment scale kind');
}

function parseRbacRole(raw: string): RbacRole {
  return parseEnum(RBAC_ROLE_VALUES, raw, 'RBAC role');
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

