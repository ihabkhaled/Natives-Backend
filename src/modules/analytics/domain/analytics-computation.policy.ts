import type {
  AttendanceFact,
  AttendanceMeasure,
  PointsFact,
} from '../model/analytics.types';

/**
 * Pure analytics computation (UN-700).
 *
 * The cardinal rule: absence of data is NULL, never zero. A member with no
 * recorded sessions in a period has a null attendance ratio (not 0%), so a chart
 * shows a gap rather than a damning false zero. A member who WAS recorded but
 * attended none has a real 0 — the two are different facts and are kept
 * different.
 */
export function measureAttendance(fact: AttendanceFact): AttendanceMeasure {
  return {
    membershipId: fact.membershipId,
    periodKey: fact.periodKey,
    ratio: fact.total === 0 ? null : fact.attended / fact.total,
    sampleSize: fact.total,
  };
}

/**
 * Consistency is the fraction of measured periods in which the member met the
 * attendance bar. A member with no measured periods has a null consistency —
 * consistency of nothing is unknown, not zero.
 */
export function measureConsistency(
  measures: readonly AttendanceMeasure[],
  bar: number,
): number | null {
  const evaluated = measures.filter(measure => measure.ratio !== null);
  if (evaluated.length === 0) {
    return null;
  }
  const met = evaluated.filter(measure => (measure.ratio ?? 0) >= bar).length;
  return met / evaluated.length;
}

/** Points always have a real value — a member with none scored a genuine 0. */
export function measurePoints(fact: PointsFact): number {
  return fact.total;
}

/** The mean of a set of non-null values, or null when the set is empty. */
export function averageOf(values: readonly (number | null)[]): number | null {
  const present = values.filter((value): value is number => value !== null);
  if (present.length === 0) {
    return null;
  }
  return present.reduce((sum, value) => sum + value, 0) / present.length;
}

export function minimumOf(values: readonly (number | null)[]): number | null {
  const present = values.filter((value): value is number => value !== null);
  return present.length === 0 ? null : Math.min(...present);
}

export function maximumOf(values: readonly (number | null)[]): number | null {
  const present = values.filter((value): value is number => value !== null);
  return present.length === 0 ? null : Math.max(...present);
}
