import type { PointsStandingRow } from '../model/signals.rows';
import type { PointsStandingSignal } from '../model/signals.types';

/** The standing of a member with no ledger history: nothing evaluated yet. */
export const EMPTY_POINTS_STANDING: PointsStandingSignal = {
  total: null,
  rank: null,
  population: null,
  asOf: null,
};

/**
 * Project the ranked ledger row into a standing signal. A member with no ledger
 * entries produces no row at all, which stays null across the board rather than
 * being reported as a zero total at last place.
 */
export function toPointsStanding(
  rows: readonly PointsStandingRow[],
): PointsStandingSignal {
  const row = rows[0];
  if (row === undefined) {
    return EMPTY_POINTS_STANDING;
  }
  return {
    total: Number(row.total),
    rank: row.rank,
    population: row.population,
    asOf: toNullableInstant(row.latest_at),
  };
}

function toNullableInstant(value: string | Date | null): Date | null {
  if (value === null) {
    return null;
  }
  return value instanceof Date ? value : new Date(value);
}
