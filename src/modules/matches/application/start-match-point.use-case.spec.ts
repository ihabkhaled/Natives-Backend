import type { AuthUserIdentity } from '@core/auth';
import type { ClockPort } from '@core/clock/clock.port';
import type {
  TransactionScope,
  UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import type {
  AuditRecorderService,
  RecordDomainEventService,
} from '@modules/platform';
import { describe, expect, it, vi } from 'vitest';

import { MatchLineupInvalidError } from '../errors/match-lineup-invalid.error';
import { MatchPointAlreadyOpenError } from '../errors/match-point-already-open.error';
import { POINT_STARTED_EVENT } from '../model/matches.constants';
import {
  CapKind,
  MatchPlayType,
  MatchResult,
  MatchStatus,
  OperationOutcome,
  PointStartingLine,
} from '../model/matches.enums';
import type {
  Match,
  MatchPlayEvent,
  MatchPointLineupEntry,
  StartPointContent,
} from '../model/matches.types';
import type { MatchLineupService } from './match-lineup.service';
import type { MatchLookupService } from './match-lookup.service';
import type { MatchPlayStreamService } from './match-play-stream.service';
import { StartMatchPointUseCase } from './start-match-point.use-case';

const TX = { run: vi.fn() } as unknown as TransactionScope;
const UOW: UnitOfWorkPort = { runInTransaction: operation => operation(TX) };
const NOW = new Date('2026-05-01T10:00:00.000Z');
const CLOCK = { now: () => NOW } as unknown as ClockPort;
const ID_GEN = { generate: () => 'start-1' };
const ACTOR: AuthUserIdentity = {
  userId: 'keeper-1',
  email: 'keeper@example.test',
  roles: [],
};

function match(overrides: Partial<Match> = {}): Match {
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
    ...overrides,
  };
}

function play(overrides: Partial<MatchPlayEvent> = {}): MatchPlayEvent {
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
    primaryMembershipId: 'bo',
    secondaryMembershipId: null,
    assistState: null,
    callahan: false,
    durationSeconds: null,
    correctsPlayId: null,
    correctionReason: null,
    retracted: false,
    notes: null,
    recordedBy: 'keeper-1',
    occurredAt: null,
    recordedAt: NOW,
    ...overrides,
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
    occurredAt: '2026-05-01T10:00:00.000Z',
    notes: null,
    ...overrides,
  };
}

function lineup(): readonly MatchPointLineupEntry[] {
  return [
    {
      lineupId: 'line-1',
      matchId: 'match-1',
      playId: 'start-1',
      pointNumber: 3,
      membershipId: 'ana',
      rosterEntryId: null,
      puller: false,
    },
  ];
}

interface Harness {
  readonly useCase: StartMatchPointUseCase;
  readonly stream: Record<string, ReturnType<typeof vi.fn>>;
  readonly lineupService: Record<string, ReturnType<typeof vi.fn>>;
  readonly audit: ReturnType<typeof vi.fn>;
  readonly enqueue: ReturnType<typeof vi.fn>;
}

function harness(overrides: Partial<Record<string, unknown>> = {}): Harness {
  const stream = {
    resolveReplay: vi.fn().mockResolvedValue(null),
    assertOpen: vi.fn(),
    findOpenPoint: vi.fn().mockResolvedValue(null),
    nextPointNumberFor: vi.fn().mockResolvedValue(3),
    sequenceFor: vi.fn().mockResolvedValue(1),
    append: vi.fn().mockResolvedValue(play()),
    ...overrides,
  };
  const lineupService = {
    assertValid: vi.fn(),
    record: vi.fn().mockResolvedValue(lineup()),
    listForPlay: vi.fn().mockResolvedValue(lineup()),
  };
  const audit = vi.fn().mockResolvedValue(undefined);
  const enqueue = vi.fn().mockResolvedValue(undefined);
  const lookup = {
    require: vi.fn().mockResolvedValue(match()),
  } as unknown as MatchLookupService;
  return {
    useCase: new StartMatchPointUseCase(
      UOW,
      CLOCK,
      ID_GEN,
      lookup,
      stream as unknown as MatchPlayStreamService,
      lineupService as unknown as MatchLineupService,
      { record: audit } as unknown as AuditRecorderService,
      { enqueue } as unknown as RecordDomainEventService,
    ),
    stream,
    lineupService,
    audit,
    enqueue,
  };
}

describe('StartMatchPointUseCase', () => {
  it('appends the point start and records its whole line', async () => {
    const { useCase, lineupService } = harness();
    const result = await useCase.execute(ACTOR, 'team-1', 'match-1', {
      content: content(),
    });
    expect(result.outcome).toBe(OperationOutcome.Applied);
    expect(result.pointNumber).toBe(3);
    expect(result.lineup).toHaveLength(1);
    expect(lineupService.record).toHaveBeenCalledTimes(1);
  });

  it('numbers the point from the starts a correction has not retracted', async () => {
    const { useCase, stream } = harness();
    await useCase.execute(ACTOR, 'team-1', 'match-1', { content: content() });
    expect(stream.nextPointNumberFor).toHaveBeenCalledWith(TX, 'match-1');
    expect(stream.append.mock.calls[0]?.[1]).toMatchObject({
      pointNumber: 3,
      playType: MatchPlayType.PointStarted,
      startingLine: PointStartingLine.Offense,
      recordedBy: 'keeper-1',
    });
  });

  it('publishes match.point_started with the line SIZE, never identities', async () => {
    const { useCase, enqueue } = harness();
    await useCase.execute(ACTOR, 'team-1', 'match-1', { content: content() });
    const event = enqueue.mock.calls[0]?.[1];
    expect(event.eventType).toBe(POINT_STARTED_EVENT);
    expect(event.payload.lineSize).toBe(1);
    expect(JSON.stringify(event.payload)).not.toContain('ana');
  });

  it('audits the append without leaking a player identity', async () => {
    const { useCase, audit } = harness();
    await useCase.execute(ACTOR, 'team-1', 'match-1', { content: content() });
    const entry = audit.mock.calls[0]?.[1];
    expect(entry.diff.playType).toBe(MatchPlayType.PointStarted);
    expect(JSON.stringify(entry.diff)).not.toContain('ana');
  });

  it('returns the stored point and its stored line on a replay', async () => {
    const { useCase, stream, lineupService } = harness({
      resolveReplay: vi.fn().mockResolvedValue(play()),
    });
    const result = await useCase.execute(ACTOR, 'team-1', 'match-1', {
      content: content(),
    });
    expect(result.outcome).toBe(OperationOutcome.Replayed);
    expect(result.lineup).toHaveLength(1);
    expect(stream.append).not.toHaveBeenCalled();
    expect(lineupService.listForPlay).toHaveBeenCalledWith(TX, 'start-1');
  });

  it('refuses to open a second point while one is still open', async () => {
    const { useCase } = harness({
      findOpenPoint: vi.fn().mockResolvedValue({
        playId: 'start-0',
        pointNumber: 2,
        period: 1,
        startingLine: PointStartingLine.Defense,
      }),
    });
    await expect(
      useCase.execute(ACTOR, 'team-1', 'match-1', { content: content() }),
    ).rejects.toBeInstanceOf(MatchPointAlreadyOpenError);
  });

  it('validates the lineup before anything is written', async () => {
    const { useCase, lineupService, stream } = harness();
    lineupService.assertValid.mockImplementation(() => {
      throw new MatchLineupInvalidError();
    });
    await expect(
      useCase.execute(ACTOR, 'team-1', 'match-1', { content: content() }),
    ).rejects.toBeInstanceOf(MatchLineupInvalidError);
    expect(stream.append).not.toHaveBeenCalled();
  });

  it('guards the scoring window before appending', async () => {
    const { useCase, stream } = harness();
    await useCase.execute(ACTOR, 'team-1', 'match-1', { content: content() });
    expect(stream.assertOpen).toHaveBeenCalledTimes(1);
  });
});
