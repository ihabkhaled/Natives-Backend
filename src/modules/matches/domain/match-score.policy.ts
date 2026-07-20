import { DEFAULT_POINT_VALUE, SCORE_MIN } from '../model/matches.constants';
import { CapKind, MatchResult, ScoringSide } from '../model/matches.enums';
import type {
  MatchRuleset,
  ScorePair,
  ScoreState,
} from '../model/matches.types';

/**
 * Pure scoring rules for a match. Every target and cap is read from the supplied
 * VERSIONED ruleset — game-to, win-by, soft cap, hard cap, time cap, and halftime
 * are never hard-coded here, so changing a competition's format is a data change
 * and a historical match keeps being explainable under the rules it was played
 * under.
 *
 * A `null` cap means the rule DOES NOT APPLY and is never read as zero. No side
 * effects, no time, no persistence — every branch is unit-tested.
 */

/** Apply one accepted point to the current pair, leaving the other side alone. */
export function applyPoint(
  score: ScorePair,
  side: ScoringSide,
  points: number,
): ScorePair {
  if (side === ScoringSide.Us) {
    return { ...score, ourScore: score.ourScore + points };
  }
  return { ...score, opponentScore: score.opponentScore + points };
}

/** Reverse a previously accepted point, never below zero. */
export function revertPoint(
  score: ScorePair,
  side: ScoringSide,
  points: number,
): ScorePair {
  if (side === ScoringSide.Us) {
    return { ...score, ourScore: Math.max(SCORE_MIN, score.ourScore - points) };
  }
  return {
    ...score,
    opponentScore: Math.max(SCORE_MIN, score.opponentScore - points),
  };
}

/** The value of a point when the caller supplied none. Always exactly one. */
export function resolvePointValue(points: number | null): number {
  return points ?? DEFAULT_POINT_VALUE;
}

/** The higher of the two scores — the leader's total. */
export function leaderScore(score: ScorePair): number {
  return Math.max(score.ourScore, score.opponentScore);
}

/** The lower of the two scores — the trailer's total. */
export function trailerScore(score: ScorePair): number {
  return Math.min(score.ourScore, score.opponentScore);
}

/**
 * The effective target under the ruleset. A soft cap raises the leader's total by
 * the configured increment once the soft-cap minute has elapsed; a hard cap always
 * bounds the result. Elapsed minutes are `null` when no clock is being tracked, in
 * which case no time-based cap can apply.
 */
export function resolveTarget(
  ruleset: MatchRuleset,
  score: ScorePair,
  elapsedMinutes: number | null,
): number {
  if (!softCapReached(ruleset, elapsedMinutes)) {
    return boundedByHardCap(ruleset, ruleset.gameTo);
  }
  const softTarget = leaderScore(score) + (ruleset.softCapPlus ?? 0);
  return boundedByHardCap(ruleset, Math.max(softTarget, leaderScore(score)));
}

/** True when the configured soft cap applies at the supplied elapsed minute. */
export function softCapReached(
  ruleset: MatchRuleset,
  elapsedMinutes: number | null,
): boolean {
  if (ruleset.softCapMinutes === null || elapsedMinutes === null) {
    return false;
  }
  return elapsedMinutes >= ruleset.softCapMinutes;
}

/** True when the configured absolute time cap has elapsed. */
export function timeCapReached(
  ruleset: MatchRuleset,
  elapsedMinutes: number | null,
): boolean {
  if (ruleset.timeCapMinutes === null || elapsedMinutes === null) {
    return false;
  }
  return elapsedMinutes >= ruleset.timeCapMinutes;
}

/** True when either side has reached the configured hard ceiling. */
export function hardCapReached(
  ruleset: MatchRuleset,
  score: ScorePair,
): boolean {
  if (ruleset.hardCap === null) {
    return false;
  }
  return leaderScore(score) >= ruleset.hardCap;
}

/**
 * True when the leader has reached the configured halftime total. `null` means
 * the format has no halftime rule — it is never treated as "halftime at zero".
 */
export function halftimeReached(
  ruleset: MatchRuleset,
  score: ScorePair,
): boolean {
  if (ruleset.halftimeAt === null) {
    return false;
  }
  return leaderScore(score) >= ruleset.halftimeAt;
}

/** The side in front, or null while the scores are level. */
export function resolveLeader(score: ScorePair): ScoringSide | null {
  if (score.ourScore > score.opponentScore) {
    return ScoringSide.Us;
  }
  if (score.opponentScore > score.ourScore) {
    return ScoringSide.Them;
  }
  return null;
}

/**
 * Evaluate the scoreboard against the ruleset: the effective target, which cap
 * decided it, whether play should end, and who leads. A hard cap ends the game
 * regardless of the win-by margin; a time cap ends it even when level (a draw).
 */
export function resolveScoreState(
  ruleset: MatchRuleset,
  score: ScorePair,
  elapsedMinutes: number | null,
): ScoreState {
  const target = resolveTarget(ruleset, score, elapsedMinutes);
  return {
    target,
    capApplied: resolveCapKind(ruleset, score, elapsedMinutes),
    complete: isComplete(ruleset, score, target, elapsedMinutes),
    winner: resolveWinner(ruleset, score, target, elapsedMinutes),
    halftimeReached: halftimeReached(ruleset, score),
  };
}

/** Which configured cap currently governs the target. */
export function resolveCapKind(
  ruleset: MatchRuleset,
  score: ScorePair,
  elapsedMinutes: number | null,
): CapKind {
  if (hardCapReached(ruleset, score)) {
    return CapKind.Hard;
  }
  if (timeCapReached(ruleset, elapsedMinutes)) {
    return CapKind.Time;
  }
  if (softCapReached(ruleset, elapsedMinutes)) {
    return CapKind.Soft;
  }
  return CapKind.None;
}

/** Translate a settled score into the team's own result. */
export function resolveResult(score: ScorePair): MatchResult {
  if (score.ourScore > score.opponentScore) {
    return MatchResult.Win;
  }
  if (score.opponentScore > score.ourScore) {
    return MatchResult.Loss;
  }
  return MatchResult.Draw;
}

function isComplete(
  ruleset: MatchRuleset,
  score: ScorePair,
  target: number,
  elapsedMinutes: number | null,
): boolean {
  if (
    hardCapReached(ruleset, score) ||
    timeCapReached(ruleset, elapsedMinutes)
  ) {
    return true;
  }
  return (
    leaderScore(score) >= target &&
    leaderScore(score) - trailerScore(score) >= ruleset.winBy
  );
}

function resolveWinner(
  ruleset: MatchRuleset,
  score: ScorePair,
  target: number,
  elapsedMinutes: number | null,
): ScoringSide | null {
  if (!isComplete(ruleset, score, target, elapsedMinutes)) {
    return null;
  }
  return resolveLeader(score);
}

function boundedByHardCap(ruleset: MatchRuleset, target: number): number {
  if (ruleset.hardCap === null) {
    return target;
  }
  return Math.min(target, ruleset.hardCap);
}
