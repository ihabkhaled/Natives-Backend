import { ScoringSide } from '../model/matches.enums';
import type {
  MatchRuleset,
  TimeoutState,
  TimeoutUsage,
} from '../model/matches.types';

/**
 * Pure timeout rules. The per-period allowance is read from the VERSIONED
 * ruleset — `timeoutsPerPeriod` when the format budgets them per half, otherwise
 * the whole-match `timeoutsPerTeam` figure. Nothing here is hard-coded, and a
 * `null` per-period budget means "the rule does not apply", never zero.
 *
 * No side effects, no time, no persistence — every branch is unit-tested.
 */

/** The number of timeouts one side may call in the current period. */
export function resolveAllowance(ruleset: MatchRuleset): number {
  return ruleset.timeoutsPerPeriod ?? ruleset.timeoutsPerTeam;
}

/** How many timeouts remain for a side, never negative. */
export function remainingTimeouts(allowance: number, used: number): number {
  return Math.max(0, allowance - used);
}

/** The full timeout budget of the current period for both sides. */
export function resolveTimeoutState(
  ruleset: MatchRuleset,
  usage: TimeoutUsage,
): TimeoutState {
  const allowance = resolveAllowance(ruleset);
  return {
    allowance,
    usedByUs: usage.usedByUs,
    usedByThem: usage.usedByThem,
    remainingForUs: remainingTimeouts(allowance, usage.usedByUs),
    remainingForThem: remainingTimeouts(allowance, usage.usedByThem),
  };
}

/** How many timeouts the supplied side has already used this period. */
export function usedBySide(usage: TimeoutUsage, side: ScoringSide): number {
  return side === ScoringSide.Us ? usage.usedByUs : usage.usedByThem;
}

/** True when the side still has a timeout available under the ruleset. */
export function canCallTimeout(
  ruleset: MatchRuleset,
  usage: TimeoutUsage,
  side: ScoringSide,
): boolean {
  return (
    remainingTimeouts(resolveAllowance(ruleset), usedBySide(usage, side)) > 0
  );
}
