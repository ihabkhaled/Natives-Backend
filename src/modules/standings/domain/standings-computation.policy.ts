import { MatchOutcome } from '../model/standings.enums';
import type {
  FinalizedMatchResult,
  StandingsRuleVersion,
  StandingTally,
} from '../model/standings.types';

/**
 * Pure standings arithmetic (UN-506).
 *
 * A tally is folded ONLY from finalized match results, and only under a named
 * rule version — the same inputs and the same version always produce the same
 * numbers, which is what makes a standings table reproducible. An `undecided`
 * result contributes its scores to nothing: it is not a draw, and treating it as
 * one would invent a result that never happened.
 */
export function emptyTally(): StandingTally {
  return {
    played: 0,
    wins: 0,
    losses: 0,
    ties: 0,
    pointsFor: 0,
    pointsAgainst: 0,
    standingPoints: 0,
  };
}

export function foldResults(
  results: readonly FinalizedMatchResult[],
  rule: StandingsRuleVersion,
): StandingTally {
  return results.reduce(
    (tally, result) => applyResult(tally, result, rule),
    emptyTally(),
  );
}

export function applyResult(
  tally: StandingTally,
  result: FinalizedMatchResult,
  rule: StandingsRuleVersion,
): StandingTally {
  if (result.result === MatchOutcome.Undecided) {
    return tally;
  }
  return {
    played: tally.played + 1,
    wins: tally.wins + (result.result === MatchOutcome.Win ? 1 : 0),
    losses: tally.losses + (result.result === MatchOutcome.Loss ? 1 : 0),
    ties: tally.ties + (result.result === MatchOutcome.Draw ? 1 : 0),
    pointsFor: tally.pointsFor + result.ourScore,
    pointsAgainst: tally.pointsAgainst + result.opponentScore,
    standingPoints: tally.standingPoints + pointsFor(result.result, rule),
  };
}

/** The standing points one outcome is worth under a rule version. */
export function pointsFor(
  outcome: MatchOutcome,
  rule: StandingsRuleVersion,
): number {
  if (outcome === MatchOutcome.Win) {
    return rule.winPoints;
  }
  if (outcome === MatchOutcome.Draw) {
    return rule.tiePoints;
  }
  if (outcome === MatchOutcome.Loss) {
    return rule.lossPoints;
  }
  return 0;
}

/** The mirrored tally of the opponent in the same set of matches. */
export function mirrorTally(tally: StandingTally): StandingTally {
  return {
    played: tally.played,
    wins: tally.losses,
    losses: tally.wins,
    ties: tally.ties,
    pointsFor: tally.pointsAgainst,
    pointsAgainst: tally.pointsFor,
    standingPoints: 0,
  };
}

/** Recompute the standing points of an already-counted tally under a rule. */
export function scoreTally(
  tally: StandingTally,
  rule: StandingsRuleVersion,
): StandingTally {
  return {
    ...tally,
    standingPoints:
      tally.wins * rule.winPoints +
      tally.ties * rule.tiePoints +
      tally.losses * rule.lossPoints,
  };
}

export function pointDifference(tally: StandingTally): number {
  return tally.pointsFor - tally.pointsAgainst;
}
