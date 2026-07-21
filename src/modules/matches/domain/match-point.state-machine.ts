import { FIRST_POINT_NUMBER } from '../model/matches.constants';
import {
  MatchPlayType,
  PointOutcome,
  PointStartingLine,
  ScoringSide,
} from '../model/matches.enums';
import type { MatchPlayEvent, OpenMatchPoint } from '../model/matches.types';

/**
 * The pure grammar of the point/possession stream. It decides which facts may be
 * appended in which order, which point number a new point takes, and how a
 * completed point classifies as a hold or a break.
 *
 * No side effects, no time, no persistence — every branch is unit-tested, because
 * these rules are what make a corrected stream replay to exactly the statistics a
 * clean stream would have produced.
 */

/** The play types a scorekeeper may append INSIDE an already-open point. */
export function isPossessionPlay(playType: MatchPlayType): boolean {
  return (
    playType !== MatchPlayType.PointStarted &&
    playType !== MatchPlayType.PointCompleted &&
    playType !== MatchPlayType.Correction
  );
}

/** True when the play type credits its subject with an opponent error. */
export function isOpponentErrorPlay(playType: MatchPlayType): boolean {
  return (
    playType === MatchPlayType.OpponentDrop ||
    playType === MatchPlayType.OpponentThrowaway
  );
}

/** True when the play type is one of our own recorded turnovers. */
export function isTurnoverPlay(playType: MatchPlayType): boolean {
  return (
    playType === MatchPlayType.Drop ||
    playType === MatchPlayType.Throwaway ||
    playType === MatchPlayType.Stall ||
    playType === MatchPlayType.Turnover
  );
}

/** A new point may only be started when none is currently open. */
export function canStartPoint(open: OpenMatchPoint | null): boolean {
  return open === null;
}

/** Completing a point, or attaching a fact to one, requires an open point. */
export function requiresOpenPoint(open: OpenMatchPoint | null): boolean {
  return open !== null;
}

/**
 * The number a newly started point takes: one past the count of point-starts
 * that a correction has NOT retracted. Retracting the start of point 3 and
 * re-appending it therefore reuses 3, which is exactly what makes the corrected
 * stream group into the same points as a clean one.
 */
export function nextPointNumber(effectiveStarts: number): number {
  return effectiveStarts + FIRST_POINT_NUMBER;
}

/** A fact still counts when nothing retracted it and it is not itself a retraction. */
export function isEffectivePlay(play: MatchPlayEvent): boolean {
  return !play.retracted && play.playType !== MatchPlayType.Correction;
}

/**
 * Classify a completed point. Winning a point started on OFFENSE is a hold and
 * winning one started on DEFENSE is a break; losing mirrors the same fact from
 * the opponent's side.
 */
export function classifyPoint(
  startingLine: PointStartingLine,
  scoringSide: ScoringSide,
): PointOutcome {
  if (scoringSide === ScoringSide.Us) {
    return startingLine === PointStartingLine.Offense
      ? PointOutcome.Hold
      : PointOutcome.Break;
  }
  return startingLine === PointStartingLine.Offense
    ? PointOutcome.OpponentBreak
    : PointOutcome.OpponentHold;
}

/** True when the classification credits our team with the point. */
export function isPointWon(outcome: PointOutcome): boolean {
  return outcome === PointOutcome.Hold || outcome === PointOutcome.Break;
}
