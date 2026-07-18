import {
  AGE_GRAND_MASTERS_MIN,
  AGE_MASTERS_MIN,
  AGE_U17_MAX_EXCLUSIVE,
  AGE_U20_MAX_EXCLUSIVE,
  DATE_PATTERN,
} from '../model/members.constants';
import { AgeClassification } from '../model/members.enums';

/**
 * Pure age-classification rules. Null-not-zero: an unknown or unparseable date
 * of birth yields `null` (not-evaluated), never a fabricated age or a zero. Ages
 * are computed in whole completed years against a caller-supplied `asOf` instant
 * so the result is deterministic under a frozen clock.
 */

/** Whole completed years between an ISO `YYYY-MM-DD` birth date and `asOf`. */
export function computeAgeYears(
  dateOfBirth: string,
  asOf: Date,
): number | null {
  if (!DATE_PATTERN.test(dateOfBirth)) {
    return null;
  }
  const born = new Date(`${dateOfBirth}T00:00:00.000Z`);
  if (Number.isNaN(born.getTime())) {
    return null;
  }
  if (dateOfBirth !== born.toISOString().slice(0, 10)) {
    return null;
  }
  let age = asOf.getUTCFullYear() - born.getUTCFullYear();
  if (isBeforeBirthdayThisYear(born, asOf)) {
    age -= 1;
  }
  return age < 0 ? null : age;
}

function isBeforeBirthdayThisYear(born: Date, asOf: Date): boolean {
  const monthDelta = asOf.getUTCMonth() - born.getUTCMonth();
  if (monthDelta < 0) {
    return true;
  }
  if (monthDelta > 0) {
    return false;
  }
  return asOf.getUTCDate() < born.getUTCDate();
}

/** Classify a date of birth into an age division, or null when unknown. */
export function classifyAge(
  dateOfBirth: string | null,
  asOf: Date,
): AgeClassification | null {
  if (dateOfBirth === null) {
    return null;
  }
  const age = computeAgeYears(dateOfBirth, asOf);
  if (age === null) {
    return null;
  }
  if (age < AGE_U17_MAX_EXCLUSIVE) {
    return AgeClassification.Under17;
  }
  if (age < AGE_U20_MAX_EXCLUSIVE) {
    return AgeClassification.Under20;
  }
  if (age >= AGE_GRAND_MASTERS_MIN) {
    return AgeClassification.GrandMasters;
  }
  if (age >= AGE_MASTERS_MIN) {
    return AgeClassification.Masters;
  }
  return AgeClassification.Senior;
}
