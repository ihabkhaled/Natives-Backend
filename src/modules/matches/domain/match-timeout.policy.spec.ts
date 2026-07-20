import { describe, expect, it } from 'vitest';

import { RulesetStatus, ScoringSide } from '../model/matches.enums';
import type { MatchRuleset, TimeoutUsage } from '../model/matches.types';
import {
  canCallTimeout,
  remainingTimeouts,
  resolveAllowance,
  resolveTimeoutState,
  usedBySide,
} from './match-timeout.policy';

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
    timeoutsPerTeam: 4,
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

function usage(usedByUs: number, usedByThem: number): TimeoutUsage {
  return { usedByUs, usedByThem };
}

describe('match timeout policy', () => {
  it('falls back to the whole-match budget when none is set per period', () => {
    expect(resolveAllowance(ruleset())).toBe(4);
    expect(resolveAllowance(ruleset({ timeoutsPerPeriod: 2 }))).toBe(2);
  });

  it('treats a configured zero per-period budget as a real zero', () => {
    expect(resolveAllowance(ruleset({ timeoutsPerPeriod: 0 }))).toBe(0);
  });

  it('never reports a negative remainder', () => {
    expect(remainingTimeouts(2, 0)).toBe(2);
    expect(remainingTimeouts(2, 2)).toBe(0);
    expect(remainingTimeouts(2, 5)).toBe(0);
  });

  it('reads the usage of the requested side', () => {
    expect(usedBySide(usage(1, 2), ScoringSide.Us)).toBe(1);
    expect(usedBySide(usage(1, 2), ScoringSide.Them)).toBe(2);
  });

  it('projects the full budget of the current period', () => {
    const state = resolveTimeoutState(
      ruleset({ timeoutsPerPeriod: 2 }),
      usage(1, 2),
    );
    expect(state).toEqual({
      allowance: 2,
      usedByUs: 1,
      usedByThem: 2,
      remainingForUs: 1,
      remainingForThem: 0,
    });
  });

  it('allows a timeout only while the side still has budget', () => {
    const rules = ruleset({ timeoutsPerPeriod: 1 });
    expect(canCallTimeout(rules, usage(0, 1), ScoringSide.Us)).toBe(true);
    expect(canCallTimeout(rules, usage(0, 1), ScoringSide.Them)).toBe(false);
    expect(canCallTimeout(rules, usage(1, 0), ScoringSide.Us)).toBe(false);
  });
});
