import { AssessmentValidationError } from '../errors/assessment-validation.error';
import { DATE_PATTERN, WEIGHT_TOTAL } from '../model/assessments.constants';
import type {
  CategoryWeightInput,
  TemplateMetricInput,
} from '../model/assessments.types';

export function assertCategoryWeights(
  weights: readonly CategoryWeightInput[],
): void {
  const categoryIds = new Set(weights.map(weight => weight.categoryId));
  const total = weights.reduce(
    (sum, weight) => sum + weight.weightPercentage,
    0,
  );
  if (categoryIds.size !== weights.length || total !== WEIGHT_TOTAL) {
    throw new AssessmentValidationError();
  }
}

export function assertRequiredMetrics(
  metrics: readonly TemplateMetricInput[],
): void {
  const metricIds = new Set(metrics.map(metric => metric.metricDefinitionId));
  const positions = new Set(metrics.map(metric => metric.sortOrder));
  if (
    metricIds.size !== metrics.length ||
    positions.size !== metrics.length ||
    metrics.length === 0
  ) {
    throw new AssessmentValidationError();
  }
}

export function assertPeriodRange(startsOn: string, endsOn: string): void {
  if (!isCalendarDate(startsOn) || !isCalendarDate(endsOn)) {
    throw new AssessmentValidationError();
  }
  if (startsOn > endsOn) {
    throw new AssessmentValidationError();
  }
}

function isCalendarDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) {
    return false;
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}
