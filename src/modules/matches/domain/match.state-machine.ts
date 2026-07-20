import { MatchStatus, MatchTransition } from '../model/matches.enums';

/**
 * Pure lifecycle state machine for a match
 * (SCHEDULED → READY → LIVE ⇄ PAUSED/HALFTIME → COMPLETED → FINALIZED, with
 * ABANDONED as the terminal off-ramp).
 *
 * FINALIZED is an IMMUTABLE state, not an editable one: the only way out is the
 * separately-permissioned, reason-carrying reopen (`match.correct`), which starts
 * a NEW revision. No plain transition verb can leave it, so a published score can
 * never be edited in place. No side effects, no time, no persistence — every
 * branch is unit-tested.
 */

const TRANSITIONS: ReadonlyMap<MatchStatus, readonly MatchStatus[]> = new Map([
  [MatchStatus.Scheduled, [MatchStatus.Ready, MatchStatus.Abandoned]],
  [MatchStatus.Ready, [MatchStatus.Live, MatchStatus.Abandoned]],
  [
    MatchStatus.Live,
    [
      MatchStatus.Paused,
      MatchStatus.Halftime,
      MatchStatus.Completed,
      MatchStatus.Abandoned,
    ],
  ],
  [MatchStatus.Paused, [MatchStatus.Live, MatchStatus.Abandoned]],
  [MatchStatus.Halftime, [MatchStatus.Live, MatchStatus.Abandoned]],
  [MatchStatus.Completed, [MatchStatus.Live, MatchStatus.Abandoned]],
  [MatchStatus.Finalized, []],
  [MatchStatus.Abandoned, []],
]);

/** The set of states reachable from `from` via a plain transition verb. */
export function allowedMatchTransitions(
  from: MatchStatus,
): readonly MatchStatus[] {
  return TRANSITIONS.get(from) ?? [];
}

/** True when moving from `from` to `to` is a permitted lifecycle transition. */
export function canTransitionMatch(
  from: MatchStatus,
  to: MatchStatus,
): boolean {
  return allowedMatchTransitions(from).includes(to);
}

/** Map a plain transition verb to the status it targets. */
export function resolveMatchTarget(transition: MatchTransition): MatchStatus {
  if (transition === MatchTransition.Ready) {
    return MatchStatus.Ready;
  }
  if (
    transition === MatchTransition.Start ||
    transition === MatchTransition.Resume
  ) {
    return MatchStatus.Live;
  }
  if (transition === MatchTransition.Pause) {
    return MatchStatus.Paused;
  }
  if (transition === MatchTransition.Halftime) {
    return MatchStatus.Halftime;
  }
  if (transition === MatchTransition.Complete) {
    return MatchStatus.Completed;
  }
  return MatchStatus.Abandoned;
}

/** Starting play stamps the kickoff instant and publishes `match.started`. */
export function isStartTransition(transition: MatchTransition): boolean {
  return transition === MatchTransition.Start;
}

/** Only a LIVE match accepts score, timeout, and void operations. */
export function isScoringOpen(status: MatchStatus): boolean {
  return status === MatchStatus.Live;
}

/** A finalized match is immutable; correcting it needs an audited reopen. */
export function isMatchFinalized(status: MatchStatus): boolean {
  return status === MatchStatus.Finalized;
}

/** Only a completed match may be finalized into an authoritative result. */
export function isFinalizable(status: MatchStatus): boolean {
  return status === MatchStatus.Completed;
}

/** A match that will never change again: finalized or abandoned. */
export function isMatchTerminal(status: MatchStatus): boolean {
  return status === MatchStatus.Finalized || status === MatchStatus.Abandoned;
}

/** Abandoning stamps a terminal instant and requires an explicit reason. */
export function isAbandonTarget(target: MatchStatus): boolean {
  return target === MatchStatus.Abandoned;
}

/** Resuming from a pause or halftime stamps the resumption instant. */
export function isResumeTransition(transition: MatchTransition): boolean {
  return transition === MatchTransition.Resume;
}
