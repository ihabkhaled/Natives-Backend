import { describe, expect, it } from 'vitest';

import {
  LIST_DEFAULT_LIMIT,
  LIST_MAX_LIMIT,
} from '../model/assessments.constants';
import { AssessmentDirection } from '../model/assessments.enums';
import type {
  CategoryRow,
  CategoryWeightRow,
  MetricRow,
  PeriodRow,
  ScaleRow,
  TemplateMetricRow,
  TemplateRow,
} from '../model/assessments.rows';
import {
  resolveAssessmentPage,
  toAssessmentCategory,
  toAssessmentMetric,
  toAssessmentPeriod,
  toAssessmentScale,
  toAssessmentTemplate,
} from './assessments.helpers';

const NOW = new Date('2026-06-01T12:00:00.000Z');

function categoryRow(overrides: Partial<CategoryRow> = {}): CategoryRow {
  return {
    id: 'category-1',
    category_key: 'technical',
    name: 'Technical',
    description: 'Skills',
    sort_order: 10,
    status: 'active',
    version: 1,
    created_at: NOW,
    ...overrides,
  };
}

function scaleRow(overrides: Partial<ScaleRow> = {}): ScaleRow {
  return {
    id: 'scale-1',
    scale_key: 'legacy_0_5',
    name: 'Legacy 0-5',
    value_kind: 'legacy_0_5',
    unit: 'rating',
    minimum_value: '0',
    maximum_value: '5',
    step_value: '1',
    categorical_options: [],
    guidance: 'guidance',
    status: 'active',
    scale_version: 1,
    created_at: NOW,
    ...overrides,
  };
}

function metricRow(overrides: Partial<MetricRow> = {}): MetricRow {
  return {
    id: 'metric-1',
    family_id: 'family-1',
    team_id: 'team-1',
    category_id: 'category-1',
    scale_id: 'scale-1',
    definition_key: 'handling',
    name: 'Handling',
    definition: 'Disc control',
    direction: 'higher_is_better',
    guidance: 'observe',
    applicability: ['player'],
    tags: ['technical'],
    status: 'active',
    definition_version: 1,
    record_version: 1,
    created_by: 'actor-1',
    archived_by: null,
    created_at: NOW,
    archived_at: null,
    ...overrides,
  };
}

function templateRow(overrides: Partial<TemplateRow> = {}): TemplateRow {
  return {
    id: 'template-1',
    family_id: 'family-1',
    team_id: 'team-1',
    season_id: null,
    template_key: 'midseason',
    name: 'Midseason',
    cohort: null,
    evaluator_roles: ['COACH'],
    score_version: 1,
    status: 'draft',
    template_version: 1,
    record_version: 1,
    published_at: null,
    published_by: null,
    created_by: 'actor-1',
    created_at: NOW,
    ...overrides,
  };
}

function periodRow(overrides: Partial<PeriodRow> = {}): PeriodRow {
  return {
    id: 'period-1',
    team_id: 'team-1',
    season_id: null,
    template_id: 'template-1',
    name: 'Q1',
    cohort: null,
    starts_on: '2026-01-01',
    ends_on: '2026-03-31',
    status: 'active',
    record_version: 1,
    created_by: 'actor-1',
    created_at: NOW,
    ...overrides,
  };
}

describe('resolveAssessmentPage', () => {
  it('falls back to the default limit and offset when absent', () => {
    expect(resolveAssessmentPage(undefined, undefined)).toEqual({
      limit: LIST_DEFAULT_LIMIT,
      offset: 0,
    });
  });

  it('caps the requested limit at the hard maximum and keeps the offset', () => {
    expect(resolveAssessmentPage(500, 40)).toEqual({
      limit: LIST_MAX_LIMIT,
      offset: 40,
    });
  });
});

describe('assessment row mappers', () => {
  it('maps a category and accepts both Date and string instants', () => {
    expect(toAssessmentCategory(categoryRow()).createdAt).toEqual(NOW);
    const stringDated = toAssessmentCategory(
      categoryRow({ created_at: '2026-06-01T12:00:00.000Z' }),
    );
    expect(stringDated.createdAt.toISOString()).toBe(
      '2026-06-01T12:00:00.000Z',
    );
  });

  it('preserves null scale bounds instead of coercing them to zero', () => {
    const open = toAssessmentScale(
      scaleRow({ maximum_value: null, step_value: null, unit: null }),
    );
    expect(open.minimumValue).toBe(0);
    expect(open.maximumValue).toBeNull();
    expect(open.stepValue).toBeNull();
    expect(open.unit).toBeNull();
  });

  it('maps a metric and its nullable archive fields', () => {
    const archived = toAssessmentMetric(
      metricRow({
        status: 'archived',
        archived_by: 'actor-2',
        archived_at: NOW,
      }),
    );
    expect(archived.direction).toBe(AssessmentDirection.HigherIsBetter);
    expect(archived.archivedAt).toEqual(NOW);
    expect(toAssessmentMetric(metricRow()).archivedAt).toBeNull();
  });

  it('maps a template with only its own weights and metrics', () => {
    const weights: readonly CategoryWeightRow[] = [
      {
        template_id: 'template-1',
        category_id: 'category-1',
        weight_percentage: 60,
      },
      {
        template_id: 'other',
        category_id: 'category-9',
        weight_percentage: 40,
      },
    ];
    const metrics: readonly TemplateMetricRow[] = [
      {
        template_id: 'template-1',
        metric_definition_id: 'metric-1',
        required: true,
        sort_order: 0,
      },
      {
        template_id: 'other',
        metric_definition_id: 'metric-9',
        required: false,
        sort_order: 0,
      },
    ];
    const template = toAssessmentTemplate(templateRow(), weights, metrics);
    expect(template.categoryWeights).toEqual([
      { categoryId: 'category-1', weightPercentage: 60 },
    ]);
    expect(template.metrics).toEqual([
      { metricDefinitionId: 'metric-1', required: true, sortOrder: 0 },
    ]);
    expect(template.evaluatorRoles).toEqual(['COACH']);
  });

  it('maps a published template with resolved publish instant', () => {
    const published = toAssessmentTemplate(
      templateRow({
        status: 'published',
        published_at: NOW,
        published_by: 'a',
      }),
      [],
      [],
    );
    expect(published.publishedAt).toEqual(NOW);
    expect(published.publishedBy).toBe('a');
  });

  it('maps a period date-only window as-is', () => {
    const period = toAssessmentPeriod(periodRow());
    expect(period.startsOn).toBe('2026-01-01');
    expect(period.endsOn).toBe('2026-03-31');
  });

  it('rejects an unrecognized enum value from the database', () => {
    expect(() =>
      toAssessmentCategory(categoryRow({ status: 'bogus' })),
    ).toThrow(/assessment status/u);
    expect(() => toAssessmentScale(scaleRow({ value_kind: 'bogus' }))).toThrow(
      /scale kind/u,
    );
    expect(() => toAssessmentMetric(metricRow({ direction: 'bogus' }))).toThrow(
      /direction/u,
    );
    expect(() =>
      toAssessmentTemplate(templateRow({ status: 'bogus' }), [], []),
    ).toThrow(/template status/u);
    expect(() =>
      toAssessmentTemplate(templateRow({ evaluator_roles: ['NOPE'] }), [], []),
    ).toThrow(/RBAC role/u);
  });
});
