import { PointsValidationError } from '../errors/points-validation.error';
import type { RuleContent } from '../model/points.types';

/**
 * Pure content invariants for a points-rule version: at least one point entry and
 * no duplicated activity category (a category must resolve to exactly one value).
 * A violation is a 400 domain validation error. No side effects, no persistence.
 */
export function assertRuleContent(content: RuleContent): void {
  if (content.pointEntries.length === 0) {
    throw new PointsValidationError();
  }
  if (hasDuplicateCategory(content)) {
    throw new PointsValidationError();
  }
}

function hasDuplicateCategory(content: RuleContent): boolean {
  const categories = content.pointEntries.map(entry => entry.activityCategory);
  return new Set(categories).size !== categories.length;
}
