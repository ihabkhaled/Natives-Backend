import {
  CALCULATION_RULE_STATUS_VALUES,
  SCORE_CATEGORY_VALUES,
  SCORE_CONFIDENCE_VALUES,
  SCORE_PROJECTION_STATUS_VALUES,
} from '../model/scoring.enums';
import type {
  CalculationRuleRow,
  CategorySourceRow,
  ScoreProjectionRow,
} from '../model/scoring.rows';
import type {
  CalculationRule,
  CategorySource,
  RuleComponent,
  ScoreExplanation,
  ScoreProjection,
} from '../model/scoring.types';
import {
  parseEnumValue,
  toDate,
  toNullableDate,
  toNullableNumber,
  toNumber,
} from './scoring.helpers';

interface RawComponent {
  readonly categoryKey: string;
  readonly weight: number;
  readonly minSample: number;
}

export function toCalculationRule(row: CalculationRuleRow): CalculationRule {
  return {
    ruleId: row.id,
    teamId: row.team_id,
    seasonId: row.season_id,
    ruleKey: row.rule_key,
    version: row.version,
    name: row.name,
    description: row.description,
    status: parseEnumValue(
      CALCULATION_RULE_STATUS_VALUES,
      row.status,
      'calculation rule status',
    ),
    scaleMin: toNumber(row.scale_min),
    scaleMax: toNumber(row.scale_max),
    minComponents: row.min_components,
    components: parseComponents(row.components),
    effectiveFrom: row.effective_from,
    effectiveTo: row.effective_to,
    recordVersion: row.record_version,
    createdBy: row.created_by,
    publishedBy: row.published_by,
    publishedAt: toNullableDate(row.published_at),
    retiredAt: toNullableDate(row.retired_at),
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
  };
}

export function toScoreProjection(row: ScoreProjectionRow): ScoreProjection {
  return {
    id: row.id,
    teamId: row.team_id,
    seasonId: row.season_id,
    membershipId: row.membership_id,
    periodId: row.period_id,
    ruleId: row.rule_id,
    ruleKey: row.rule_key,
    ruleVersion: row.rule_version,
    status: parseEnumValue(
      SCORE_PROJECTION_STATUS_VALUES,
      row.status,
      'score projection status',
    ),
    value: toNullableNumber(row.overall_value),
    numerator: toNullableNumber(row.overall_numerator),
    denominator: toNullableNumber(row.overall_denominator),
    includedCount: row.included_count,
    excludedCount: row.excluded_count,
    completeness: toNumber(row.completeness),
    confidence: parseEnumValue(
      SCORE_CONFIDENCE_VALUES,
      row.confidence,
      'score confidence',
    ),
    explanation: parseExplanation(row.explanation),
    sourceHash: row.source_hash,
    error: row.error,
    computedAt: toNullableDate(row.computed_at),
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
  };
}

/** One membership's aggregated source facts for a single category. */
export interface MembershipCategorySource {
  readonly membershipId: string;
  readonly source: CategorySource;
}

export function toCategorySource(
  row: CategorySourceRow,
): MembershipCategorySource {
  return {
    membershipId: row.membership_id,
    source: {
      categoryKey: parseEnumValue(
        SCORE_CATEGORY_VALUES,
        row.category_key,
        'score category',
      ),
      values: row.values.map(value => toNumber(value)),
      totalMetrics: row.total_metrics,
    },
  };
}

export function parseComponents(raw: unknown): readonly RuleComponent[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.map(entry => toComponent(entry as RawComponent));
}

function toComponent(entry: RawComponent): RuleComponent {
  return {
    categoryKey: parseEnumValue(
      SCORE_CATEGORY_VALUES,
      entry.categoryKey,
      'score category',
    ),
    weight: toNumber(entry.weight),
    minSample: entry.minSample,
  };
}

function parseExplanation(raw: unknown): ScoreExplanation | null {
  if (raw === null || raw === undefined) {
    return null;
  }
  return raw as ScoreExplanation;
}
