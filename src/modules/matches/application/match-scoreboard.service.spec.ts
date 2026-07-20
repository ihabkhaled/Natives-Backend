import type { ClockPort } from '@core/clock/clock.port';
import type {
  TransactionScope,
  UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { describe, expect, it, vi } from 'vitest';

import type { MatchEventRepository } from '../infrastructure/match-event.repository';
import {
  CapKind,
  MatchResult,
  MatchStatus,
  RulesetStatus,
} from '../model/matches.enums';
import type { Match, MatchRuleset } from '../model/matches.types';
import type { MatchLookupService } from './match-lookup.service';
import { MatchScoreboardService } from './match-scoreboard.service';

const TX = { run: vi.fn() } as unknown as TransactionScope;
const UOW: UnitOfWorkPort = { runInTransaction: operation => operation(TX) };
const START = new Date('2026-03-01T10:00:00.000Z');
const NOW = new Date('2026-03-01T10:50:00.000Z');
const CLOCK = { now: () => NOW } as unknown as ClockPort;

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
    ourScore: 12,
    opponentScore: 10,
    period: 2,
    streamVersion: 22,
    recordVersion: 8,
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
    rulesetVersion: 2,
    name: 'Indoor',
    gameTo: 15,
    winBy: 1,
    hardCap: null,
    softCapMinutes: 40,
    softCapPlus: 1,
    timeCapMinutes: null,
    halftimeAt: 8,
    timeoutsPerTeam: 2,
    timeoutsPerPeriod: 1,
    periods: 2,
    status: RulesetStatus.Active,
    notes: null,
    createdBy: null,
    createdAt: START,
    updatedAt: START,
    ...overrides,
  };
}

function build(options: { match?: Match; usage?: [number, number] }): {
  service: MatchScoreboardService;
  countTimeouts: ReturnType<typeof vi.fn>;
} {
  const [usedByUs, usedByThem] = options.usage ?? [1, 0];
  const countTimeouts = vi.fn().mockResolvedValue({ usedByUs, usedByThem });
  const lookup = {
    require: vi.fn().mockResolvedValue(options.match ?? match()),
    requireRuleset: vi.fn().mockResolvedValue(ruleset()),
  } as unknown as MatchLookupService;
  return {
    service: new MatchScoreboardService(UOW, CLOCK, lookup, {
      countTimeouts,
    } as unknown as MatchEventRepository),
    countTimeouts,
  };
}

describe('MatchScoreboardService', () => {
  it('projects the live scoreboard from the stream and the versioned rules', async () => {
    const { service, countTimeouts } = build({});
    const board = await service.getForMatch('team-1', 'match-1');
    expect(board).toMatchObject({
      matchId: 'match-1',
      ourScore: 12,
      opponentScore: 10,
      streamVersion: 22,
      rulesetKey: 'wfdf-indoor',
      rulesetVersion: 2,
      capApplied: CapKind.Soft,
      target: 13,
      halftimeReached: true,
      scoringOpen: true,
    });
    expect(countTimeouts).toHaveBeenCalledWith(TX, 'match-1', 2);
  });

  it('counts the timeout budget of the current period only', async () => {
    const { service } = build({ usage: [1, 0] });
    const board = await service.getForMatch('team-1', 'match-1');
    expect(board.timeouts).toEqual({
      allowance: 1,
      usedByUs: 1,
      usedByThem: 0,
      remainingForUs: 0,
      remainingForThem: 1,
    });
  });

  it('closes scoring once a match is finalized', async () => {
    const { service } = build({
      match: match({ status: MatchStatus.Finalized, result: MatchResult.Win }),
    });
    const board = await service.getForMatch('team-1', 'match-1');
    expect(board.scoringOpen).toBe(false);
    expect(board.result).toBe(MatchResult.Win);
  });

  it('projects a match already loaded in the caller transaction', async () => {
    const { service } = build({});
    const board = await service.projectFor(TX, match({ period: 1 }));
    expect(board.period).toBe(1);
  });
});
