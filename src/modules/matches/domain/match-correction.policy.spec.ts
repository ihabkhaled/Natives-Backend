import { describe, expect, it } from 'vitest';

import {
  CapKind,
  MatchResult,
  MatchRevisionAction,
  MatchStatus,
} from '../model/matches.enums';
import type { Match } from '../model/matches.types';
import {
  canReopen,
  isAssertedScoreConflicting,
  isScoreChanged,
  nextRevision,
  resolveFinalizeAction,
  toAssertedScore,
  toCurrentScore,
} from './match-correction.policy';

const NOW = new Date('2026-03-01T10:00:00.000Z');

function match(overrides: Partial<Match> = {}): Match {
  return {
    matchId: 'match-1',
    teamId: 'team-1',
    seasonId: 'season-1',
    competitionId: 'comp-1',
    fixtureId: 'fixture-1',
    rosterId: null,
    rulesetId: 'rules-1',
    status: MatchStatus.Finalized,
    homeAway: 'home',
    ourScore: 15,
    opponentScore: 12,
    period: 2,
    streamVersion: 27,
    recordVersion: 9,
    revision: 1,
    result: MatchResult.Win,
    capApplied: CapKind.None,
    engineVersion: 'match-scoring-v1',
    supersedesMatchId: null,
    reopenReason: null,
    reopenedBy: null,
    reopenedAt: null,
    createdBy: 'user-1',
    startedAt: NOW,
    pausedAt: null,
    resumedAt: null,
    halftimeAt: null,
    completedAt: NOW,
    finalizedBy: 'admin-1',
    finalizedAt: NOW,
    abandonedAt: null,
    abandonReason: null,
    notes: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

describe('match correction policy', () => {
  it('allows a reopen only from finalized', () => {
    expect(canReopen(MatchStatus.Finalized)).toBe(true);
    for (const status of [
      MatchStatus.Scheduled,
      MatchStatus.Ready,
      MatchStatus.Live,
      MatchStatus.Paused,
      MatchStatus.Halftime,
      MatchStatus.Completed,
      MatchStatus.Abandoned,
    ]) {
      expect(canReopen(status)).toBe(false);
    }
  });

  it('numbers the next revision one past the current one', () => {
    expect(nextRevision(1)).toBe(2);
    expect(nextRevision(4)).toBe(5);
  });

  it('names a first publication "finalized" and every later one "corrected"', () => {
    expect(resolveFinalizeAction(1)).toBe(MatchRevisionAction.Finalized);
    expect(resolveFinalizeAction(2)).toBe(MatchRevisionAction.Corrected);
  });

  it('detects a change on either side of the pair', () => {
    const before = { ourScore: 15, opponentScore: 12 };
    expect(isScoreChanged(before, { ourScore: 15, opponentScore: 12 })).toBe(
      false,
    );
    expect(isScoreChanged(before, { ourScore: 14, opponentScore: 12 })).toBe(
      true,
    );
    expect(isScoreChanged(before, { ourScore: 15, opponentScore: 13 })).toBe(
      true,
    );
  });

  it('builds an asserted pair only when the caller supplied both sides', () => {
    expect(toAssertedScore(15, 12)).toEqual({
      ourScore: 15,
      opponentScore: 12,
    });
    expect(toAssertedScore(null, 12)).toBeNull();
    expect(toAssertedScore(15, null)).toBeNull();
    expect(toAssertedScore(null, null)).toBeNull();
  });

  it('never treats an unasserted score as a conflict', () => {
    expect(
      isAssertedScoreConflicting({ ourScore: 15, opponentScore: 12 }, null),
    ).toBe(false);
  });

  it('refuses an asserted score that disagrees with the projected one', () => {
    const projected = { ourScore: 15, opponentScore: 12 };
    expect(
      isAssertedScoreConflicting(projected, {
        ourScore: 15,
        opponentScore: 12,
      }),
    ).toBe(false);
    expect(
      isAssertedScoreConflicting(projected, {
        ourScore: 15,
        opponentScore: 11,
      }),
    ).toBe(true);
  });

  it('reads the current pair off a match record', () => {
    expect(toCurrentScore(match())).toEqual({
      ourScore: 15,
      opponentScore: 12,
    });
  });
});
