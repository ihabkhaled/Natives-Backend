import { COHORT_PRIVACY_THRESHOLD } from '../model/analytics.constants';
import type { AnalyticsDimension } from '../model/analytics.enums';
import type { CohortComparison } from '../model/analytics.types';
import {
  averageOf,
  maximumOf,
  minimumOf,
} from './analytics-computation.policy';

/**
 * Pure cohort-privacy rules (UN-700).
 *
 * A cohort comparison is only ever exposed when the cohort is large enough that
 * an aggregate statistic cannot single out an individual. Below the threshold
 * the comparison is SUPPRESSED: it still reports the sample size (so an operator
 * knows why nothing came back) but every statistic is null. Correlation is never
 * dressed up as causation — the comparison exposes descriptive statistics only.
 */
export function meetsPrivacyThreshold(sampleSize: number): boolean {
  return sampleSize >= COHORT_PRIVACY_THRESHOLD;
}

export function buildCohortComparison(
  dimension: AnalyticsDimension,
  periodKey: string,
  values: readonly (number | null)[],
): CohortComparison {
  const present = values.filter((value): value is number => value !== null);
  const sampleSize = present.length;
  if (!meetsPrivacyThreshold(sampleSize)) {
    return suppressed(dimension, periodKey, sampleSize);
  }
  return {
    dimension,
    periodKey,
    sampleSize,
    suppressed: false,
    average: averageOf(present),
    minimum: minimumOf(present),
    maximum: maximumOf(present),
  };
}

export function suppressed(
  dimension: AnalyticsDimension,
  periodKey: string,
  sampleSize: number,
): CohortComparison {
  return {
    dimension,
    periodKey,
    sampleSize,
    suppressed: true,
    average: null,
    minimum: null,
    maximum: null,
  };
}
