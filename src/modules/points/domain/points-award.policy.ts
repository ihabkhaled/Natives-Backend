import { MILLISECONDS_PER_DAY } from '../model/points.constants';
import { AwardSkipReason, PointsApproval } from '../model/points.enums';
import type {
  AwardDecision,
  AwardInput,
  RulePointEntry,
} from '../model/points.types';

/**
 * The deterministic, side-effect-free award calculator — the single authority for
 * how many points an approved activity earns under a published rule version. It
 * resolves in strict order: no rule entry for the activity category, a
 * pending/unresolved activity value, a null point value, the per-category daily
 * cap, then the per-category cooldown; only if none fire is the entry's value
 * awarded. Idempotency (one award per submission per rule) is enforced separately
 * by the ledger's unique key. Every branch is golden- and unit-tested.
 */
export function computeAward(input: AwardInput): AwardDecision {
  const entry = input.entry;
  if (entry === null) {
    return skip(AwardSkipReason.NoRuleEntry);
  }
  if (input.pointsApproval === PointsApproval.Pending) {
    return skip(AwardSkipReason.PendingApproval);
  }
  if (entry.points === null) {
    return skip(AwardSkipReason.NoValue);
  }
  if (isCapReached(entry, input.facts.sameDayCount)) {
    return skip(AwardSkipReason.Cap);
  }
  if (isWithinCooldown(entry, input.facts.lastAwardOn, input.performedOn)) {
    return skip(AwardSkipReason.Cooldown);
  }
  return {
    awarded: true,
    amount: entry.points,
    skipReason: AwardSkipReason.None,
  };
}

/** Resolve the rule's point entry for an activity category (null when absent). */
export function resolvePointEntry(
  entries: readonly RulePointEntry[],
  category: string,
): RulePointEntry | null {
  return entries.find(entry => entry.activityCategory === category) ?? null;
}

/** Whole calendar days between two ISO date-only strings (never negative). */
export function daysBetween(fromIso: string, toIso: string): number {
  const from = Date.parse(`${fromIso}T00:00:00.000Z`);
  const to = Date.parse(`${toIso}T00:00:00.000Z`);
  return Math.abs(Math.round((to - from) / MILLISECONDS_PER_DAY));
}

function isCapReached(entry: RulePointEntry, sameDayCount: number): boolean {
  return entry.dailyCap !== null && sameDayCount >= entry.dailyCap;
}

function isWithinCooldown(
  entry: RulePointEntry,
  lastAwardOn: string | null,
  performedOn: string,
): boolean {
  if (entry.cooldownDays === null || lastAwardOn === null) {
    return false;
  }
  return daysBetween(lastAwardOn, performedOn) < entry.cooldownDays;
}

function skip(reason: AwardSkipReason): AwardDecision {
  return { awarded: false, amount: 0, skipReason: reason };
}
