import {
  FRESHNESS_STALE_HOURS,
  MILLISECONDS_PER_HOUR,
} from '../model/analytics.constants';
import type {
  AnalyticsProjection,
  SeriesPoint,
} from '../model/analytics.types';

/**
 * Pure chart-ready series shaping (UN-700).
 *
 * A series preserves null gaps: a period with no evaluated value keeps a null
 * point, so a renderer draws a break rather than interpolating a fake value. The
 * accessible summary is generated from the present points only — it describes
 * what is known and stays silent about what is not.
 */
export function toSeriesPoints(
  projections: readonly AnalyticsProjection[],
): readonly SeriesPoint[] {
  return [...projections]
    .sort((left, right) => left.periodKey.localeCompare(right.periodKey))
    .map(projection => ({
      periodKey: projection.periodKey,
      value: projection.value,
      sampleSize: projection.sampleSize,
    }));
}

/** A concise, screen-reader-friendly summary of a series' present points. */
export function summarizeSeries(points: readonly SeriesPoint[]): string {
  const present = points.filter(point => point.value !== null);
  if (present.length === 0) {
    return 'No evaluated data points in this period.';
  }
  const first = present[0];
  const last = present[present.length - 1];
  if (first === undefined || last === undefined) {
    return 'No evaluated data points in this period.';
  }
  return `${present.length} evaluated point(s); from ${format(first.value)} to ${format(last.value)}.`;
}

/** The latest computed-at across a set of projections, or null when empty. */
export function latestComputedAt(
  projections: readonly AnalyticsProjection[],
): Date | null {
  if (projections.length === 0) {
    return null;
  }
  return projections.reduce<Date>(
    (latest, projection) =>
      projection.computedAt.getTime() > latest.getTime()
        ? projection.computedAt
        : latest,
    projections[0]?.computedAt ?? new Date(0),
  );
}

/** Whether a computed instant is older than the freshness window. */
export function isStale(computedAt: Date | null, now: Date): boolean {
  if (computedAt === null) {
    return true;
  }
  return (
    now.getTime() - computedAt.getTime() >
    FRESHNESS_STALE_HOURS * MILLISECONDS_PER_HOUR
  );
}

function format(value: number | null): string {
  return value === null ? 'unknown' : value.toFixed(2);
}
