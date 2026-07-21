import type {
  TransactionScope,
  UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { describe, expect, it, vi } from 'vitest';

import { MatchNotFoundError } from '../errors/match-not-found.error';
import type { MatchPlayEventRepository } from '../infrastructure/match-play-event.repository';
import type { MatchPointLineupRepository } from '../infrastructure/match-point-lineup.repository';
import type { MatchRosterRepository } from '../infrastructure/match-roster.repository';
import { MATCH_STATS_ENGINE_VERSION } from '../model/matches.constants';
import {
  CapKind,
  MatchPlayType,
  MatchResult,
  MatchStatus,
  PointStartingLine,
  RulesetStatus,
  ScoringSide,
} from '../model/matches.enums';
import type {
  Match,
  MatchPlayEvent,
  MatchRuleset,
} from '../model/matches.types';
import type { MatchLookupService } from './match-lookup.service';
import { MatchStatisticsService } from './match-statistics.service';

const TX = { run: vi.fn() } as unknown as TransactionScope;
const UOW: UnitOfWorkPort = { runInTransaction: operation => operation(TX) };
const NOW = new Date('2026-05-01T10:00:00.000Z');

function match(): Match {
  return {
    matchId: 'match-1',
    teamId: 'team-1',
    seasonId: 'season-1',
    competitionId: 'comp-1',
    fixtureId: 'fixture-1',
    rosterId: 'roster-1',
    rulesetId: 'rules-1',
    status: MatchStatus.Live,
    homeAway: 'home',
    ourScore: 1,
    opponentScore: 0,
    period: 1,
    streamVersion: 0,
    recordVersion: 1,
    revision: 1,
    result: MatchResult.Undecided,
    capApplied: CapKind.None,
    engineVersion: 'match-scoring-v1',
    supersedesMatchId: null,
    reopenReason: null,
    reopenedBy: null,
    reopenedAt: null,
    createdBy: 'coach-1',
    startedAt: NOW,
    pausedAt: null,
    resumedAt: null,
    halftimeAt: null,
    completedAt: null,
    finalizedBy: null,
    finalizedAt: null,
    abandonedAt: null,
    abandonReason: null,
    notes: null,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function ruleset(opponentErrorAttribution = true): MatchRuleset {
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
    halftimeAt: null,
    timeoutsPerTeam: 2,
    timeoutsPerPeriod: null,
    periods: 2,
    opponentErrorAttribution,
    status: RulesetStatus.Active,
    notes: null,
    createdBy: 'coach-1',
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function play(overrides: Partial<MatchPlayEvent> = {}): MatchPlayEvent {
  return {
    playId: 'play-1',
    matchId: 'match-1',
    teamId: 'team-1',
    sequence: 1,
    operationId: 'op-1',
    requestHash: 'hash-1',
    playType: MatchPlayType.PointStarted,
    pointNumber: 1,
    period: 1,
    startingLine: PointStartingLine.Offense,
    scoringSide: null,
    primaryMembershipId: null,
    secondaryMembershipId: null,
    assistState: null,
    callahan: false,
    durationSeconds: null,
    correctsPlayId: null,
    correctionReason: null,
    retracted: false,
    notes: null,
    recordedBy: 'user-1',
    occurredAt: null,
    recordedAt: NOW,
    ...overrides,
  };
}

interface Harness {
  readonly service: MatchStatisticsService;
  readonly listAll: ReturnType<typeof vi.fn>;
  readonly listLineups: ReturnType<typeof vi.fn>;
  readonly listMembers: ReturnType<typeof vi.fn>;
}

function harness(attribution = true, missing = false): Harness {
  const listAll = vi.fn().mockResolvedValue([
    play(),
    play({
      playId: 'done-1',
      sequence: 2,
      playType: MatchPlayType.PointCompleted,
      startingLine: null,
      scoringSide: ScoringSide.Us,
    }),
  ]);
  const listLineups = vi.fn().mockResolvedValue([
    {
      lineupId: 'line-1',
      matchId: 'match-1',
      playId: 'play-1',
      pointNumber: 1,
      membershipId: 'ana',
      rosterEntryId: 'entry-ana',
      puller: true,
    },
  ]);
  const listMembers = vi.fn().mockResolvedValue([
    { membershipId: 'ana', rosterEntryId: 'entry-ana' },
    { membershipId: 'zed', rosterEntryId: 'entry-zed' },
  ]);
  const lookup = {
    require: missing
      ? vi.fn().mockRejectedValue(new MatchNotFoundError())
      : vi.fn().mockResolvedValue(match()),
    requireRuleset: vi.fn().mockResolvedValue(ruleset(attribution)),
  } as unknown as MatchLookupService;
  return {
    service: new MatchStatisticsService(
      UOW,
      lookup,
      { listAllForMatch: listAll } as unknown as MatchPlayEventRepository,
      { listForMatch: listLineups } as unknown as MatchPointLineupRepository,
      { listMembers } as unknown as MatchRosterRepository,
    ),
    listAll,
    listLineups,
    listMembers,
  };
}

describe('MatchStatisticsService', () => {
  it('derives the projection from the stream, lineups, roster, and ruleset', async () => {
    const { service, listAll, listLineups, listMembers } = harness();
    const statistics = await service.getForMatch('team-1', 'match-1');
    expect(listAll).toHaveBeenCalledWith(TX, 'match-1');
    expect(listLineups).toHaveBeenCalledWith(TX, 'match-1');
    expect(listMembers).toHaveBeenCalledWith(TX, 'match-1');
    expect(statistics.team.pointsCompleted).toBe(1);
  });

  it('cites the versioned ruleset and the named engine', async () => {
    const statistics = await harness().service.getForMatch('team-1', 'match-1');
    expect(statistics.rulesetKey).toBe('wfdf-indoor');
    expect(statistics.rulesetVersion).toBe(3);
    expect(statistics.statsEngineVersion).toBe(MATCH_STATS_ENGINE_VERSION);
  });

  it('keeps every rostered player, at a measured zero', async () => {
    const statistics = await harness().service.getForMatch('team-1', 'match-1');
    const zed = statistics.players.find(
      player => player.membershipId === 'zed',
    );
    expect(zed?.pointsPlayed).toBe(0);
    expect(zed?.rostered).toBe(true);
  });

  it('reports opponent errors as null when the ruleset withholds them', async () => {
    const statistics = await harness(false).service.getForMatch(
      'team-1',
      'match-1',
    );
    expect(statistics.team.opponentErrors).toBeNull();
    expect(statistics.opponentErrorAttribution).toBe(false);
  });

  it('hides another team’s match behind a not-found', async () => {
    await expect(
      harness(true, true).service.getForMatch('team-9', 'match-1'),
    ).rejects.toBeInstanceOf(MatchNotFoundError);
  });

  it('projects a match already loaded in a caller transaction', async () => {
    const statistics = await harness().service.projectFor(TX, match());
    expect(statistics.matchId).toBe('match-1');
  });
});
