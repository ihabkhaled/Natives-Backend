import { isScoringOpen } from '../domain/match.state-machine';
import { resolveScoreState } from '../domain/match-score.policy';
import { resolveTimeoutState } from '../domain/match-timeout.policy';
import type {
  Match,
  MatchRuleset,
  MatchScoreboard,
  TimeoutUsage,
} from '../model/matches.types';
import { toScore } from './matches.builders';

/**
 * Projects the live scoreboard from the authoritative match record, the VERSIONED
 * ruleset it is being played under, and the timeout usage counted off the stream.
 *
 * Nothing here is stored: the target, the cap that decided it, the completion
 * signal, and the timeout budget are all re-derived from the same pure rules the
 * scoring path uses, and the projection cites the ruleset key/version and engine
 * version so a displayed number is always explainable.
 */
export function buildScoreboard(
  match: Match,
  ruleset: MatchRuleset,
  usage: TimeoutUsage,
  elapsedMinutes: number | null,
): MatchScoreboard {
  const score = toScore(match);
  const state = resolveScoreState(ruleset, score, elapsedMinutes);
  return {
    matchId: match.matchId,
    status: match.status,
    ourScore: match.ourScore,
    opponentScore: match.opponentScore,
    period: match.period,
    streamVersion: match.streamVersion,
    recordVersion: match.recordVersion,
    revision: match.revision,
    result: match.result,
    rulesetKey: ruleset.rulesetKey,
    rulesetVersion: ruleset.rulesetVersion,
    engineVersion: match.engineVersion,
    target: state.target,
    capApplied: state.capApplied,
    complete: state.complete,
    halftimeReached: state.halftimeReached,
    timeouts: resolveTimeoutState(ruleset, usage),
    scoringOpen: isScoringOpen(match.status),
  };
}

/**
 * The whole minutes of play elapsed since kickoff, or null when the match has not
 * started. Null is honest: no clock means no time-based cap can be evaluated, and
 * it is never substituted with zero.
 */
export function resolveElapsedMinutes(match: Match, now: Date): number | null {
  if (match.startedAt === null) {
    return null;
  }
  return Math.max(
    0,
    Math.floor((now.getTime() - match.startedAt.getTime()) / 60_000),
  );
}
