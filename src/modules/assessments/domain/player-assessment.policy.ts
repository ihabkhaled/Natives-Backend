import { AssessmentIncompleteError } from '../errors/assessment-incomplete.error';
import { AssessmentSelfApprovalError } from '../errors/assessment-self-approval.error';
import { AssessmentValidationError } from '../errors/assessment-validation.error';
import type {
  AssessmentValueInput,
  TemplateMetricBound,
} from '../model/player-assessments.types';

/**
 * Pure business rules for per-player assessment values and review integrity. All
 * value checks honour null-not-zero: a NULL numeric/text value is a legitimate
 * "not evaluated" and is never treated as a measured zero. No side effects, no
 * time, no persistence — every branch is unit-tested.
 */

/** True when the observation carries a real measurement (not "not evaluated"). */
export function isMeasured(value: AssessmentValueInput): boolean {
  return value.numericValue !== null || value.textValue !== null;
}

/**
 * Validate a set of submitted values against the template's metric slots: every
 * value must reference a template metric exactly once, and each present numeric
 * value must fall within its scale bounds. A null numeric value is always allowed
 * (not evaluated).
 */
export function assertValuesAgainstTemplate(
  values: readonly AssessmentValueInput[],
  metrics: readonly TemplateMetricBound[],
): void {
  const bounds = new Map(
    metrics.map(metric => [metric.metricDefinitionId, metric]),
  );
  const seen = new Set<string>();
  for (const value of values) {
    const bound = bounds.get(value.metricDefinitionId);
    if (bound === undefined || seen.has(value.metricDefinitionId)) {
      throw new AssessmentValidationError();
    }
    seen.add(value.metricDefinitionId);
    assertNumericInBounds(value.numericValue, bound);
  }
}

/**
 * Enforce completeness at submit time: every REQUIRED template metric must carry
 * a measured value. A missing or null required value blocks submission — it is
 * never inferred as zero.
 */
export function assertComplete(
  values: readonly AssessmentValueInput[],
  metrics: readonly TemplateMetricBound[],
): void {
  const measured = new Set(
    values.filter(value => isMeasured(value)).map(v => v.metricDefinitionId),
  );
  const missing = metrics.some(
    metric => metric.required && !measured.has(metric.metricDefinitionId),
  );
  if (missing) {
    throw new AssessmentIncompleteError();
  }
}

/**
 * The reviewer must not be the evaluator who authored the assessment: no
 * self-review and, critically, no self-approval.
 */
export function assertReviewerIndependence(
  reviewerUserId: string,
  evaluatorUserId: string,
): void {
  if (reviewerUserId === evaluatorUserId) {
    throw new AssessmentSelfApprovalError();
  }
}

function assertNumericInBounds(
  numericValue: number | null,
  bound: TemplateMetricBound,
): void {
  if (numericValue === null) {
    return;
  }
  if (!Number.isFinite(numericValue)) {
    throw new AssessmentValidationError();
  }
  if (bound.minimumValue !== null && numericValue < bound.minimumValue) {
    throw new AssessmentValidationError();
  }
  if (bound.maximumValue !== null && numericValue > bound.maximumValue) {
    throw new AssessmentValidationError();
  }
}
