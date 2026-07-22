import {
  AnalyticsDimension,
  AnalyticsPeriodType,
} from '../model/analytics.enums';
import type {
  CohortComparisonQuery,
  CohortComparisonQueryInput,
  SeriesQuery,
  SeriesQueryInput,
} from '../model/analytics.types';

/** Normalize a series query, defaulting the dimension and monthly buckets. */
export function toSeriesQuery(input: SeriesQueryInput): SeriesQuery {
  return {
    dimension: input.dimension ?? AnalyticsDimension.Attendance,
    periodType: input.periodType ?? AnalyticsPeriodType.Monthly,
  };
}

export function toCohortComparisonQuery(
  input: CohortComparisonQueryInput,
): CohortComparisonQuery {
  return {
    dimension: input.dimension,
    periodType: input.periodType ?? AnalyticsPeriodType.Monthly,
    periodKey: input.periodKey,
  };
}
