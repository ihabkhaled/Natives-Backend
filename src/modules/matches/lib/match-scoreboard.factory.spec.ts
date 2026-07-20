import { describe, expect, it } from 'vitest';

import {
  CapKind,
  MatchResult,
  MatchStatus,
  RulesetStatus,
} from '../model/matches.enums';
import type { Match, MatchRuleset } from '../model/matches.types';
import {
  buildScoreboard,
  resolveElapsedMinutes,
} from './match-scoreboard.factory';

const START = new Date('2026-03-01T10:00:00.000Z');
const NOW = new Date('2026-03-01T10:45:30.000Z');

function match(overrides: Partial<Match> = {}): Match {
  return {
    matchId: 'match-1',
    teamId: 'team-1',
    seasonId: 'season-1',
    competitionId: 'comp-1',
    fixtureId: 'fixture-1',
    rosterId: null,
    rulesetId: 'rules-1',
    status: MatchStatus.Live,
    homeAway: 'home',
    ourScore: 9,
    opponentScore: 7,
    period: 1,
    streamVersion: 16,
    recordVersion: 6,
    revision: 1,
    result: MatchResult.Undecided,
    capApplied: CapKind.None,
    engineVersion: 'match-scoring-v1',
    supersedesMatchId: null,
    reopenReason: null,
    reopenedBy: null,
    reopenedAt: null,
    createdBy: 'user-1',
    startedAt: START,
    pausedAt: null,
    resumedAt: null,
    halftimeAt: null,
    completedAt: null,
    finalizedBy: null,
    finalizedAt: null,
    abandonedAt: null,
    abandonReason: null,
    notes: null,
    createdAt: START,
    updatedAt: START,
    ...overrides,
  };
}

function ruleset(overrides: Partial<MatchRuleset> = {}): MatchRuleset {
  return {
    rulesetId: 'rules-1',
    teamId: 'team-1',
    seasonId: null,
    rulesetKey: 'wfdf-indoor',
    rulesetVersion: 3,
    name: 'Indoor',
    gameTo: 15,
    winBy: 1,
    hardCap: null,
    softCapMinutes: null,
    softCapPlus: null,
    timeCapMinutes: null,
    halftimeAt: 8,
    timeoutsPerTeam: 2,
    timeoutsPerPeriod: null,
    periods: 2,
    status: RulesetStatus.Active,
    notes: null,
    createdBy: null,
    createdAt: START,
    updatedAt: START,
    ...overrides,
  };
}

describe('match scoreboard factory', () => {
  it('reports null elapsed minutes before kickoff, never zero', () => {
    expect(resolveElapsedMinutes(match({ startedAt: null }), NOW)).toBeNull();
  });

  it('counts whole elapsed minutes since kickoff', () => {
    expect(resolveElapsedMinutes(match(), NOW)).toBe(45);
  });

  it('never reports negative elapsed minutes from a skewed clock', () => {
    expect(
      resolveElapsedMinutes(match(), new Date('2026-03-01T09:00:00.000Z')),
    ).toBe(0);
  });

  it('projects the scoreboard and cites the versioned rules it used', () => {
    const board = buildScoreboard(
      match(),
      ruleset(),
      { usedByUs: 1, usedByThem: 0 },
      45,
    );
    expect(board).toMatchObject({
      matchId: 'match-1',
      status: MatchStatus.Live,
      ourScore: 9,
      opponentScore: 7,
      streamVersion: 16,
      rulesetKey: 'wfdf-indoor',
      rulesetVersion: 3,
      engineVersion: 'match-scoring-v1',
      target: 15,
      capApplied: CapKind.None,
      complete: false,
      halftimeReached: true,
      scoringOpen: true,
    });
    expect(board.timeouts).toEqual({
      allowance: 2,
      usedByUs: 1,
      usedByThem: 0,
      remainingForUs: 1,
      remainingForThem: 2,
    });
  });

  it('closes scoring on a finalized match', () => {
    const board = buildScoreboard(
      match({ status: MatchStatus.Finalized, result: MatchResult.Win }),
      ruleset(),
      { usedByUs: 0, usedByThem: 0 },
      null,
    );
    expect(board.scoringOpen).toBe(false);
    expect(board.result).toBe(MatchResult.Win);
  });

  it('surfaces a cap that has taken effect', () => {
    const board = buildScoreboard(
      match({ ourScore: 13, opponentScore: 11 }),
      ruleset({ softCapMinutes: 40, softCapPlus: 1 }),
      { usedByUs: 0, usedByThem: 0 },
      45,
    );
    expect(board.capApplied).toBe(CapKind.Soft);
    expect(board.target).toBe(14);
  });
});
