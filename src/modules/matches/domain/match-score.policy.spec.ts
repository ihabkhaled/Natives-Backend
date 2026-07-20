import { describe, expect, it } from 'vitest';

import {
  CapKind,
  MatchResult,
  RulesetStatus,
  ScoringSide,
} from '../model/matches.enums';
import type { MatchRuleset, ScorePair } from '../model/matches.types';
import {
  applyPoint,
  halftimeReached,
  hardCapReached,
  leaderScore,
  resolveCapKind,
  resolveLeader,
  resolvePointValue,
  resolveResult,
  resolveScoreState,
  resolveTarget,
  revertPoint,
  softCapReached,
  timeCapReached,
  trailerScore,
} from './match-score.policy';

const NOW = new Date('2026-03-01T10:00:00.000Z');

function ruleset(overrides: Partial<MatchRuleset> = {}): MatchRuleset {
  return {
    rulesetId: 'rules-1',
    teamId: 'team-1',
    seasonId: null,
    rulesetKey: 'wfdf-indoor',
    rulesetVersion: 1,
    name: 'Indoor',
    gameTo: 15,
    winBy: 1,
    hardCap: null,
    softCapMinutes: null,
    softCapPlus: null,
    timeCapMinutes: null,
    halftimeAt: null,
    timeoutsPerTeam: 2,
    timeoutsPerPeriod: null,
    periods: 2,
    status: RulesetStatus.Active,
    notes: null,
    createdBy: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function score(ourScore: number, opponentScore: number): ScorePair {
  return { ourScore, opponentScore };
}

describe('match score policy', () => {
  it('applies a point to the scoring side only', () => {
    expect(applyPoint(score(3, 4), ScoringSide.Us, 1)).toEqual(score(4, 4));
    expect(applyPoint(score(3, 4), ScoringSide.Them, 2)).toEqual(score(3, 6));
  });

  it('reverts a point without ever going below zero', () => {
    expect(revertPoint(score(3, 4), ScoringSide.Us, 1)).toEqual(score(2, 4));
    expect(revertPoint(score(3, 4), ScoringSide.Them, 2)).toEqual(score(3, 2));
    expect(revertPoint(score(0, 0), ScoringSide.Us, 1)).toEqual(score(0, 0));
    expect(revertPoint(score(0, 0), ScoringSide.Them, 1)).toEqual(score(0, 0));
  });

  it('defaults an unspecified point to exactly one', () => {
    expect(resolvePointValue(null)).toBe(1);
    expect(resolvePointValue(2)).toBe(2);
  });

  it('reads the leader and trailer off the pair', () => {
    expect(leaderScore(score(9, 12))).toBe(12);
    expect(trailerScore(score(9, 12))).toBe(9);
  });

  it('names the leading side and null while level', () => {
    expect(resolveLeader(score(5, 3))).toBe(ScoringSide.Us);
    expect(resolveLeader(score(3, 5))).toBe(ScoringSide.Them);
    expect(resolveLeader(score(3, 3))).toBeNull();
  });

  it('keeps the plain game-to target when no cap is configured', () => {
    expect(resolveTarget(ruleset(), score(5, 4), 90)).toBe(15);
  });

  it('treats a missing soft cap or a missing clock as "does not apply"', () => {
    expect(softCapReached(ruleset(), 90)).toBe(false);
    expect(softCapReached(ruleset({ softCapMinutes: 40 }), null)).toBe(false);
    expect(softCapReached(ruleset({ softCapMinutes: 40 }), 39)).toBe(false);
    expect(softCapReached(ruleset({ softCapMinutes: 40 }), 40)).toBe(true);
  });

  it('raises the target to the leader plus the configured increment at soft cap', () => {
    const rules = ruleset({ softCapMinutes: 40, softCapPlus: 2 });
    expect(resolveTarget(rules, score(9, 7), 45)).toBe(11);
  });

  it('never lowers the target below the leader when no increment is set', () => {
    const rules = ruleset({ softCapMinutes: 40, softCapPlus: null });
    expect(resolveTarget(rules, score(9, 7), 45)).toBe(9);
  });

  it('bounds any target by the hard cap, capped and uncapped', () => {
    const capped = ruleset({
      hardCap: 17,
      softCapMinutes: 40,
      softCapPlus: 5,
    });
    expect(resolveTarget(capped, score(16, 12), 45)).toBe(17);
    expect(resolveTarget(ruleset({ hardCap: 17 }), score(2, 1), null)).toBe(15);
  });

  it('treats a missing time cap or a missing clock as "does not apply"', () => {
    expect(timeCapReached(ruleset(), 500)).toBe(false);
    expect(timeCapReached(ruleset({ timeCapMinutes: 60 }), null)).toBe(false);
    expect(timeCapReached(ruleset({ timeCapMinutes: 60 }), 59)).toBe(false);
    expect(timeCapReached(ruleset({ timeCapMinutes: 60 }), 60)).toBe(true);
  });

  it('treats a missing hard cap as "does not apply"', () => {
    expect(hardCapReached(ruleset(), score(99, 1))).toBe(false);
    expect(hardCapReached(ruleset({ hardCap: 17 }), score(16, 1))).toBe(false);
    expect(hardCapReached(ruleset({ hardCap: 17 }), score(17, 1))).toBe(true);
  });

  it('treats a missing halftime rule as "does not apply", never zero', () => {
    expect(halftimeReached(ruleset(), score(0, 0))).toBe(false);
    expect(halftimeReached(ruleset({ halftimeAt: 8 }), score(7, 2))).toBe(
      false,
    );
    expect(halftimeReached(ruleset({ halftimeAt: 8 }), score(8, 2))).toBe(true);
  });

  it('reports which cap governs the target, hard first', () => {
    expect(resolveCapKind(ruleset(), score(4, 3), 10)).toBe(CapKind.None);
    expect(
      resolveCapKind(ruleset({ softCapMinutes: 40 }), score(4, 3), 45),
    ).toBe(CapKind.Soft);
    expect(
      resolveCapKind(ruleset({ timeCapMinutes: 60 }), score(4, 3), 61),
    ).toBe(CapKind.Time);
    expect(
      resolveCapKind(
        ruleset({ hardCap: 17, timeCapMinutes: 60, softCapMinutes: 40 }),
        score(17, 3),
        61,
      ),
    ).toBe(CapKind.Hard);
  });

  it('completes a game on the target once the win-by margin is met', () => {
    const rules = ruleset({ gameTo: 15, winBy: 2 });
    expect(resolveScoreState(rules, score(15, 14), null).complete).toBe(false);
    const settled = resolveScoreState(rules, score(16, 14), null);
    expect(settled.complete).toBe(true);
    expect(settled.winner).toBe(ScoringSide.Us);
    expect(settled.target).toBe(15);
  });

  it('completes on the hard cap regardless of the win-by margin', () => {
    const rules = ruleset({ gameTo: 15, winBy: 2, hardCap: 17 });
    const settled = resolveScoreState(rules, score(17, 16), null);
    expect(settled.complete).toBe(true);
    expect(settled.capApplied).toBe(CapKind.Hard);
    expect(settled.winner).toBe(ScoringSide.Us);
  });

  it('completes on the time cap and reports a level game as no winner', () => {
    const rules = ruleset({ timeCapMinutes: 60 });
    const settled = resolveScoreState(rules, score(9, 9), 61);
    expect(settled.complete).toBe(true);
    expect(settled.capApplied).toBe(CapKind.Time);
    expect(settled.winner).toBeNull();
  });

  it('reports an unfinished game as incomplete with no winner', () => {
    const state = resolveScoreState(ruleset(), score(3, 2), 5);
    expect(state.complete).toBe(false);
    expect(state.winner).toBeNull();
    expect(state.capApplied).toBe(CapKind.None);
    expect(state.halftimeReached).toBe(false);
  });

  it('surfaces the halftime signal on the evaluated state', () => {
    const state = resolveScoreState(
      ruleset({ halftimeAt: 8 }),
      score(8, 5),
      null,
    );
    expect(state.halftimeReached).toBe(true);
  });

  it('translates a settled score into the team’s own result', () => {
    expect(resolveResult(score(15, 12))).toBe(MatchResult.Win);
    expect(resolveResult(score(12, 15))).toBe(MatchResult.Loss);
    expect(resolveResult(score(12, 12))).toBe(MatchResult.Draw);
  });
});
