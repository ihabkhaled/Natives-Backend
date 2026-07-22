import { ROUNDING_TOLERANCE } from '../model/migration.constants';
import { DiscrepancyClassification } from '../model/migration.enums';
import type { ComparisonInput } from '../model/migration.types';

/**
 * Pure discrepancy classification (UN-704).
 *
 * Compares a normalized TARGET calculation against the approved LEGACY behavior
 * and explains any difference. The target is NEVER forced to match a known
 * `#REF!`/`#N/A` legacy defect: a broken legacy reference is classified as such
 * and the target's honest value stands. A legacy zero against a target null is a
 * missing-vs-zero difference, not agreement — the two are different facts. Every
 * outcome is one of the documented classifications, so a human sign-off reviews
 * a labelled list, never a wall of raw numbers.
 */
export function classifyDiscrepancy(
  input: ComparisonInput,
): DiscrepancyClassification {
  if (input.legacyBroken) {
    return DiscrepancyClassification.BrokenReference;
  }
  if (isMissingVsZero(input)) {
    return DiscrepancyClassification.MissingVsZero;
  }
  if (input.legacyValue === null || input.targetValue === null) {
    return DiscrepancyClassification.PrivacyExclusion;
  }
  return classifyNumeric(input);
}

export function isMissingVsZero(input: ComparisonInput): boolean {
  const legacyZero = input.legacyValue === 0 && input.targetValue === null;
  const targetZero = input.targetValue === 0 && input.legacyValue === null;
  return legacyZero || targetZero;
}

export function differenceOf(input: ComparisonInput): number | null {
  if (input.legacyValue === null || input.targetValue === null) {
    return null;
  }
  return input.targetValue - input.legacyValue;
}

function classifyNumeric(input: ComparisonInput): DiscrepancyClassification {
  const difference = differenceOf(input) ?? 0;
  const magnitude = Math.abs(difference);
  if (magnitude === 0) {
    return DiscrepancyClassification.Matching;
  }
  if (magnitude <= ROUNDING_TOLERANCE) {
    return DiscrepancyClassification.Rounding;
  }
  if (versionsDiffer(input)) {
    return DiscrepancyClassification.VersionDifference;
  }
  return DiscrepancyClassification.TargetBug;
}

function versionsDiffer(input: ComparisonInput): boolean {
  if (input.legacyRuleVersion === null || input.targetRuleVersion === null) {
    return false;
  }
  return input.legacyRuleVersion !== input.targetRuleVersion;
}
