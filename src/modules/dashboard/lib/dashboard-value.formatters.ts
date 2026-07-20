import type { DashboardMetricUnit } from '../model/dashboard.enums';

/**
 * Server-owned display strings. The client renders these verbatim so no screen
 * ever recomputes a score or invents a rounding rule. A null measurement yields
 * a null string — never "0", never a dash.
 */

export function formatCount(value: number | null): string | null {
  return value === null ? null : String(value);
}

export function formatPercent(value: number | null): string | null {
  return value === null ? null : `${Math.round(value)}%`;
}

export function formatPoints(value: number | null): string | null {
  return value === null ? null : String(Math.round(value));
}

/** A rank reads as its position out of the ranked population. */
export function formatRank(
  rank: number | null,
  population: number | null,
): string | null {
  if (rank === null || population === null) {
    return null;
  }
  return `${rank}/${population}`;
}

/** The unit only exists once there is a value to attach it to. */
export function unitFor(
  value: number | null,
  unit: DashboardMetricUnit,
): DashboardMetricUnit | null {
  return value === null ? null : unit;
}
