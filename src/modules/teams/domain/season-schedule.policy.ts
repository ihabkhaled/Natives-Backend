import type { SeasonDateRange } from '../model/teams.types';

/**
 * Pure season-scheduling rules. Dates are ISO `YYYY-MM-DD` strings, which compare
 * correctly with lexical `<=`/`>=`, so no Date construction (and no timezone
 * ambiguity) is needed. Bounds are inclusive on both ends.
 */

/** A season is valid only when it does not end before it starts. */
export function isValidSeasonRange(startsOn: string, endsOn: string): boolean {
  return startsOn <= endsOn;
}

/**
 * Two inclusive date ranges overlap iff each starts on or before the other ends.
 * Adjacent-but-touching ranges (one ends the same day the next starts) count as
 * overlapping, matching the inclusive-bound model.
 */
export function rangesOverlap(
  firstStart: string,
  firstEnd: string,
  secondStart: string,
  secondEnd: string,
): boolean {
  return firstStart <= secondEnd && secondStart <= firstEnd;
}

/**
 * Find the first existing season whose date range overlaps the candidate range,
 * ignoring the season being updated (`excludeId`). Returns null when the
 * candidate range is free. Callers pass only non-archived seasons as `existing`.
 */
export function findOverlappingSeason(
  existing: readonly SeasonDateRange[],
  candidateStart: string,
  candidateEnd: string,
  excludeId: string | null,
): SeasonDateRange | null {
  for (const season of existing) {
    if (season.id === excludeId) {
      continue;
    }
    if (
      rangesOverlap(
        candidateStart,
        candidateEnd,
        season.startsOn,
        season.endsOn,
      )
    ) {
      return season;
    }
  }
  return null;
}
