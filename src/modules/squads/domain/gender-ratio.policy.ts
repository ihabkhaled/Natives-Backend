import {
  GENDER_TOKEN_MAN,
  GENDER_TOKEN_NONBINARY,
  GENDER_TOKEN_WOMAN,
} from '../model/squads.constants';
import { GenderBucket } from '../model/squads.enums';
import type { GenderCount, GenderRatio } from '../model/squads.types';

/**
 * Pure gender-ratio balance for a set of selected players (UN-501). Bucketing a
 * raw self-declared gender string into men/women/mixed/unknown, then reporting an
 * ADVISORY `balanced` indicator: a squad with both men and women present is
 * balanced. Undisclosed/absent genders are `unknown` (null-not-zero), never
 * assumed. This is never a selection gate — only a signal surfaced to the coach.
 */

/** Bucket a raw profile gender token; anything unrecognized is `unknown`. */
export function bucketGender(gender: string | null): GenderBucket {
  if (gender === GENDER_TOKEN_MAN) {
    return GenderBucket.Men;
  }
  if (gender === GENDER_TOKEN_WOMAN) {
    return GenderBucket.Women;
  }
  if (gender === GENDER_TOKEN_NONBINARY) {
    return GenderBucket.Mixed;
  }
  return GenderBucket.Unknown;
}

/**
 * Fold raw gender/count rows (grouped by the selected players' profile gender)
 * into the advisory gender-ratio summary, bucketing each gender here so the
 * classification lives in one tested place rather than in a SQL CASE expression.
 */
export function summarizeGenderRatio(
  counts: readonly GenderCount[],
): GenderRatio {
  const men = sumBucket(counts, GenderBucket.Men);
  const women = sumBucket(counts, GenderBucket.Women);
  const mixed = sumBucket(counts, GenderBucket.Mixed);
  const unknown = sumBucket(counts, GenderBucket.Unknown);
  const total = men + women + mixed + unknown;
  return { men, women, mixed, unknown, total, balanced: men > 0 && women > 0 };
}

function sumBucket(
  counts: readonly GenderCount[],
  bucket: GenderBucket,
): number {
  return counts
    .filter(item => bucketGender(item.gender) === bucket)
    .reduce((sum, item) => sum + item.count, 0);
}
