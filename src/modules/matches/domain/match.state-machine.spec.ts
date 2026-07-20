import { describe, expect, it } from 'vitest';

import { MatchStatus, MatchTransition } from '../model/matches.enums';
import {
  allowedMatchTransitions,
  canTransitionMatch,
  isAbandonTarget,
  isFinalizable,
  isMatchFinalized,
  isMatchTerminal,
  isResumeTransition,
  isScoringOpen,
  isStartTransition,
  resolveMatchTarget,
} from './match.state-machine';

describe('match state machine', () => {
  it('exposes the full transition table', () => {
    expect(allowedMatchTransitions(MatchStatus.Scheduled)).toEqual([
      MatchStatus.Ready,
      MatchStatus.Abandoned,
    ]);
    expect(allowedMatchTransitions(MatchStatus.Ready)).toEqual([
      MatchStatus.Live,
      MatchStatus.Abandoned,
    ]);
    expect(allowedMatchTransitions(MatchStatus.Live)).toEqual([
      MatchStatus.Paused,
      MatchStatus.Halftime,
      MatchStatus.Completed,
      MatchStatus.Abandoned,
    ]);
    expect(allowedMatchTransitions(MatchStatus.Paused)).toEqual([
      MatchStatus.Live,
      MatchStatus.Abandoned,
    ]);
    expect(allowedMatchTransitions(MatchStatus.Halftime)).toEqual([
      MatchStatus.Live,
      MatchStatus.Abandoned,
    ]);
    expect(allowedMatchTransitions(MatchStatus.Completed)).toEqual([
      MatchStatus.Live,
      MatchStatus.Abandoned,
    ]);
  });

  it('leaves finalized and abandoned with no plain transition at all', () => {
    expect(allowedMatchTransitions(MatchStatus.Finalized)).toEqual([]);
    expect(allowedMatchTransitions(MatchStatus.Abandoned)).toEqual([]);
    expect(canTransitionMatch(MatchStatus.Finalized, MatchStatus.Live)).toBe(
      false,
    );
    expect(canTransitionMatch(MatchStatus.Abandoned, MatchStatus.Live)).toBe(
      false,
    );
  });

  it('returns an empty set for an unmapped status', () => {
    expect(allowedMatchTransitions('nonsense' as MatchStatus)).toEqual([]);
  });

  it('accepts only the transitions on the table', () => {
    expect(canTransitionMatch(MatchStatus.Ready, MatchStatus.Live)).toBe(true);
    expect(canTransitionMatch(MatchStatus.Scheduled, MatchStatus.Live)).toBe(
      false,
    );
    expect(canTransitionMatch(MatchStatus.Live, MatchStatus.Ready)).toBe(false);
  });

  it('maps every verb to the status it targets', () => {
    expect(resolveMatchTarget(MatchTransition.Ready)).toBe(MatchStatus.Ready);
    expect(resolveMatchTarget(MatchTransition.Start)).toBe(MatchStatus.Live);
    expect(resolveMatchTarget(MatchTransition.Resume)).toBe(MatchStatus.Live);
    expect(resolveMatchTarget(MatchTransition.Pause)).toBe(MatchStatus.Paused);
    expect(resolveMatchTarget(MatchTransition.Halftime)).toBe(
      MatchStatus.Halftime,
    );
    expect(resolveMatchTarget(MatchTransition.Complete)).toBe(
      MatchStatus.Completed,
    );
    expect(resolveMatchTarget(MatchTransition.Abandon)).toBe(
      MatchStatus.Abandoned,
    );
  });

  it('opens scoring only while a match is live', () => {
    expect(isScoringOpen(MatchStatus.Live)).toBe(true);
    for (const status of [
      MatchStatus.Scheduled,
      MatchStatus.Ready,
      MatchStatus.Paused,
      MatchStatus.Halftime,
      MatchStatus.Completed,
      MatchStatus.Finalized,
      MatchStatus.Abandoned,
    ]) {
      expect(isScoringOpen(status)).toBe(false);
    }
  });

  it('recognizes the immutable and terminal states', () => {
    expect(isMatchFinalized(MatchStatus.Finalized)).toBe(true);
    expect(isMatchFinalized(MatchStatus.Completed)).toBe(false);
    expect(isMatchTerminal(MatchStatus.Finalized)).toBe(true);
    expect(isMatchTerminal(MatchStatus.Abandoned)).toBe(true);
    expect(isMatchTerminal(MatchStatus.Live)).toBe(false);
  });

  it('allows finalization only from completed', () => {
    expect(isFinalizable(MatchStatus.Completed)).toBe(true);
    expect(isFinalizable(MatchStatus.Live)).toBe(false);
    expect(isFinalizable(MatchStatus.Finalized)).toBe(false);
  });

  it('flags the transitions that stamp their own instants', () => {
    expect(isStartTransition(MatchTransition.Start)).toBe(true);
    expect(isStartTransition(MatchTransition.Resume)).toBe(false);
    expect(isResumeTransition(MatchTransition.Resume)).toBe(true);
    expect(isResumeTransition(MatchTransition.Pause)).toBe(false);
    expect(isAbandonTarget(MatchStatus.Abandoned)).toBe(true);
    expect(isAbandonTarget(MatchStatus.Completed)).toBe(false);
  });
});
