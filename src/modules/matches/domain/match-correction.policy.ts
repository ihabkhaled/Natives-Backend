import { MatchRevisionAction, MatchStatus } from '../model/matches.enums';
import type { Match, ScorePair } from '../model/matches.types';

/**
 * Pure correction rules. A finalized match is IMMUTABLE: the only lawful path to
 * a different published score is an explicit, reason-carrying reopen followed by
 * a re-finalization, and every step appends an immutable revision row recording
 * the score before and after. A conflicting final score therefore always surfaces
 * as an attributable delta and is never silently merged.
 *
 * No side effects, no time, no persistence — every branch is unit-tested.
 */

/** Only a finalized match may be reopened for correction. */
export function canReopen(status: MatchStatus): boolean {
  return status === MatchStatus.Finalized;
}

/** The revision number a reopening starts. */
export function nextRevision(revision: number): number {
  return revision + 1;
}

/** A first publication is `finalized`; every later one is a `corrected`. */
export function resolveFinalizeAction(revision: number): MatchRevisionAction {
  return revision > 1
    ? MatchRevisionAction.Corrected
    : MatchRevisionAction.Finalized;
}

/** True when the two score pairs differ in either direction. */
export function isScoreChanged(before: ScorePair, after: ScorePair): boolean {
  return (
    before.ourScore !== after.ourScore ||
    before.opponentScore !== after.opponentScore
  );
}

/**
 * True when a caller asserted a final score that disagrees with the score the
 * event stream projects. The caller is refused rather than merged — the stream is
 * the only authority, and a disagreement is a real, reportable conflict.
 */
export function isAssertedScoreConflicting(
  projected: ScorePair,
  asserted: ScorePair | null,
): boolean {
  if (asserted === null) {
    return false;
  }
  return isScoreChanged(projected, asserted);
}

/** The score pair a caller asserted, or null when they asserted none. */
export function toAssertedScore(
  ourScore: number | null,
  opponentScore: number | null,
): ScorePair | null {
  if (ourScore === null || opponentScore === null) {
    return null;
  }
  return { ourScore, opponentScore };
}

/** The score pair currently projected onto the match record. */
export function toCurrentScore(match: Match): ScorePair {
  return { ourScore: match.ourScore, opponentScore: match.opponentScore };
}
