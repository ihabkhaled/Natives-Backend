import type {
  RuleContent,
  RuleContentInput,
  RulePointEntry,
  RulePointEntryInput,
} from '../model/points.types';

/**
 * Normalizes the loosely-typed transport input into the strict rule-content
 * command shape. Absent optional fields become explicit nulls (a missing point
 * value is never coerced to zero), keeping controllers a single delegation and
 * downstream layers free of `undefined`.
 */
export function toRuleContent(input: RuleContentInput): RuleContent {
  return {
    ruleKey: input.ruleKey,
    name: input.name,
    description: input.description ?? null,
    seasonId: input.seasonId ?? null,
    effectiveFrom: input.effectiveFrom ?? null,
    effectiveTo: input.effectiveTo ?? null,
    pointEntries: input.pointEntries.map(entry => toPointEntry(entry)),
  };
}

function toPointEntry(input: RulePointEntryInput): RulePointEntry {
  return {
    activityCategory: input.activityCategory,
    points: input.points ?? null,
    dailyCap: input.dailyCap ?? null,
    cooldownDays: input.cooldownDays ?? null,
  };
}
