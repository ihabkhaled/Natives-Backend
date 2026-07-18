import { describe, expect, it } from 'vitest';

import { AssessmentValidationError } from '../errors/assessment-validation.error';
import type {
  CategoryWeightInput,
  TemplateMetricInput,
} from '../model/assessments.types';
import {
  assertCategoryWeights,
  assertPeriodRange,
  assertRequiredMetrics,
} from './assessment-catalog.policy';

const WEIGHTS: readonly CategoryWeightInput[] = [
  { categoryId: 'category-1', weightPercentage: 60 },
  { categoryId: 'category-2', weightPercentage: 40 },
];

const METRICS: readonly TemplateMetricInput[] = [
  { metricDefinitionId: 'metric-1', required: true, sortOrder: 0 },
  { metricDefinitionId: 'metric-2', required: false, sortOrder: 1 },
];

describe('assessment catalog policy', () => {
  it('accepts unique category weights totaling exactly 100', () => {
    expect(() => assertCategoryWeights(WEIGHTS)).not.toThrow();
  });

  it('rejects weights that do not total 100', () => {
    expect(() =>
      assertCategoryWeights([
        { categoryId: 'category-1', weightPercentage: 50 },
      ]),
    ).toThrow(AssessmentValidationError);
  });

  it('rejects duplicate categories even when the total is 100', () => {
    expect(() =>
      assertCategoryWeights([
        { categoryId: 'category-1', weightPercentage: 50 },
        { categoryId: 'category-1', weightPercentage: 50 },
      ]),
    ).toThrow(AssessmentValidationError);
  });

  it('accepts ordered inclusive period dates', () => {
    expect(() => assertPeriodRange('2026-01-01', '2026-06-30')).not.toThrow();
  });

  it('rejects reversed or impossible period dates', () => {
    expect(() => assertPeriodRange('2026-07-01', '2026-06-30')).toThrow(
      AssessmentValidationError,
    );
    expect(() => assertPeriodRange('2026-02-31', '2026-06-30')).toThrow(
      AssessmentValidationError,
    );
  });

  it('rejects a date that does not match the calendar pattern', () => {
    expect(() => assertPeriodRange('not-a-date', '2026-06-30')).toThrow(
      AssessmentValidationError,
    );
  });

  it('rejects an empty required-metric set', () => {
    expect(() => assertRequiredMetrics([])).toThrow(AssessmentValidationError);
  });

  it('accepts unique required/optional metrics with deterministic positions', () => {
    expect(() => assertRequiredMetrics(METRICS)).not.toThrow();
  });

  it('rejects duplicate metrics and duplicate positions', () => {
    expect(() =>
      assertRequiredMetrics([
        ...METRICS,
        { metricDefinitionId: 'metric-1', required: false, sortOrder: 2 },
      ]),
    ).toThrow(AssessmentValidationError);
    expect(() =>
      assertRequiredMetrics([
        ...METRICS,
        { metricDefinitionId: 'metric-3', required: false, sortOrder: 1 },
      ]),
    ).toThrow(AssessmentValidationError);
  });
});
