import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { describe, expect, it, vi } from 'vitest';

import { MatchLineupInvalidError } from '../errors/match-lineup-invalid.error';
import type { MatchPointLineupRepository } from '../infrastructure/match-point-lineup.repository';
import type { MatchRosterRepository } from '../infrastructure/match-roster.repository';
import {
  CapKind,
  MatchPlayType,
  MatchResult,
  MatchStatus,
  PointStartingLine,
} from '../model/matches.enums';
import type {
  Match,
  MatchPlayEvent,
  MatchPointLineupEntry,
  NewMatchPointLineupEntry,
  StartPointContent,
} from '../model/matches.types';
import { MatchLineupService } from './match-lineup.service';
import type { MatchScopeService } from './match-scope.service';

const TX = { run: vi.fn() } as unknown as TransactionScope;
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
    ourScore: 0,
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

function play(): MatchPlayEvent {
  return {
    playId: 'start-1',
    matchId: 'match-1',
    teamId: 'team-1',
    sequence: 1,
    operationId: 'op-1',
    requestHash: 'hash-1',
    playType: MatchPlayType.PointStarted,
    pointNumber: 3,
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
  };
}

function content(
  overrides: Partial<StartPointContent> = {},
): StartPointContent {
  return {
    operationId: 'op-1',
    startingLine: PointStartingLine.Offense,
    lineMembershipIds: ['ana', 'bo'],
    pullerMembershipId: 'bo',
    occurredAt: null,
    notes: null,
    ...overrides,
  };
}

function entry(membershipId: string): MatchPointLineupEntry {
  return {
    lineupId: `line-${membershipId}`,
    matchId: 'match-1',
    playId: 'start-1',
    pointNumber: 3,
    membershipId,
    rosterEntryId: `entry-${membershipId}`,
    puller: false,
  };
}

interface Harness {
  readonly service: MatchLineupService;
  readonly insert: ReturnType<typeof vi.fn>;
  readonly requireMembership: ReturnType<typeof vi.fn>;
  readonly findEntryId: ReturnType<typeof vi.fn>;
}

function harness(): Harness {
  const insert = vi
    .fn()
    .mockImplementation((_tx: unknown, row: NewMatchPointLineupEntry) =>
      Promise.resolve(entry(row.membershipId)),
    );
  const requireMembership = vi.fn().mockResolvedValue(undefined);
  const findEntryId = vi.fn().mockResolvedValue('entry-1');
  const lineups = {
    insert,
    listForPlay: vi.fn().mockResolvedValue([entry('ana')]),
    listForMatch: vi.fn().mockResolvedValue([entry('ana'), entry('bo')]),
  } as unknown as MatchPointLineupRepository;
  const roster = { findEntryId } as unknown as MatchRosterRepository;
  const scope = { requireMembership } as unknown as MatchScopeService;
  const idGenerator = { generate: () => 'line-1' };
  return {
    service: new MatchLineupService(idGenerator, lineups, roster, scope),
    insert,
    requireMembership,
    findEntryId,
  };
}

describe('MatchLineupService', () => {
  it('accepts a valid line', () => {
    expect(() => harness().service.assertValid(content())).not.toThrow();
  });

  it('rejects a line that breaks a configured constraint', () => {
    const { service } = harness();
    expect(() =>
      service.assertValid(content({ lineMembershipIds: ['ana', 'ana'] })),
    ).toThrow(MatchLineupInvalidError);
    expect(() =>
      service.assertValid(content({ pullerMembershipId: 'ghost' })),
    ).toThrow(MatchLineupInvalidError);
  });

  it('records one row per named player, checking each against the team', async () => {
    const { service, insert, requireMembership } = harness();
    const recorded = await service.record(TX, match(), play(), content(), NOW);
    expect(recorded.map(row => row.membershipId)).toEqual(['ana', 'bo']);
    expect(requireMembership).toHaveBeenCalledTimes(2);
    expect(insert).toHaveBeenCalledTimes(2);
  });

  it('flags exactly the named puller and ties the row to the point', async () => {
    const { service, insert } = harness();
    await service.record(TX, match(), play(), content(), NOW);
    const rows = insert.mock.calls.map(
      call => call[1] as NewMatchPointLineupEntry,
    );
    expect(rows.map(row => row.puller)).toEqual([false, true]);
    expect(rows.every(row => row.playId === 'start-1')).toBe(true);
    expect(rows.every(row => row.pointNumber === 3)).toBe(true);
  });

  it('cites the roster entry each player was selected under', async () => {
    const { service, insert, findEntryId } = harness();
    await service.record(TX, match(), play(), content(), NOW);
    expect(findEntryId).toHaveBeenCalledWith(TX, 'match-1', 'ana');
    const row = insert.mock.calls[0]?.[1] as NewMatchPointLineupEntry;
    expect(row.rosterEntryId).toBe('entry-1');
  });

  it('reads back the line of a point and of a whole match', async () => {
    const { service } = harness();
    await expect(service.listForPlay(TX, 'start-1')).resolves.toHaveLength(1);
    await expect(service.listForMatch(TX, 'match-1')).resolves.toHaveLength(2);
  });
});
