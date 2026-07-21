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

import { MatchPointNotOpenError } from '../errors/match-point-not-open.error';
import { POINT_COMPLETED_EVENT } from '../model/matches.constants';
import {
  CapKind,
  MatchPlayType,
  MatchResult,
  MatchStatus,
  OperationOutcome,
  PointStartingLine,
  ScoringSide,
} from '../model/matches.enums';
import type {
  CompletePointContent,
  Match,
  MatchPlayEvent,
} from '../model/matches.types';
import { CompleteMatchPointUseCase } from './complete-match-point.use-case';
import type { MatchLookupService } from './match-lookup.service';
import type { MatchPlayStreamService } from './match-play-stream.service';

const TX = { run: vi.fn() } as unknown as TransactionScope;
const UOW: UnitOfWorkPort = { runInTransaction: operation => operation(TX) };
const NOW = new Date('2026-05-01T10:00:00.000Z');
const CLOCK = { now: () => NOW } as unknown as ClockPort;
const ID_GEN = { generate: () => 'done-1' };
const ACTOR: AuthUserIdentity = {
  userId: 'keeper-1',
  email: 'keeper@example.test',
  roles: [],
};

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

function play(overrides: Partial<MatchPlayEvent> = {}): MatchPlayEvent {
  return {
    playId: 'done-1',
    matchId: 'match-1',
    teamId: 'team-1',
    sequence: 4,
    operationId: 'op-1',
    requestHash: 'hash-1',
    playType: MatchPlayType.PointCompleted,
    pointNumber: 2,
    period: 1,
    startingLine: null,
    scoringSide: ScoringSide.Us,
    primaryMembershipId: null,
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
  overrides: Partial<CompletePointContent> = {},
): CompletePointContent {
  return {
    operationId: 'op-1',
    scoringSide: ScoringSide.Us,
    durationSeconds: null,
    occurredAt: null,
    notes: null,
    ...overrides,
  };
}

interface Harness {
  readonly useCase: CompleteMatchPointUseCase;
  readonly stream: Record<string, ReturnType<typeof vi.fn>>;
  readonly audit: ReturnType<typeof vi.fn>;
  readonly enqueue: ReturnType<typeof vi.fn>;
}

function harness(overrides: Partial<Record<string, unknown>> = {}): Harness {
  const stream = {
    resolveReplay: vi.fn().mockResolvedValue(null),
    assertOpen: vi.fn(),
    findOpenPoint: vi.fn().mockResolvedValue({
      playId: 'start-1',
      pointNumber: 2,
      period: 1,
      startingLine: PointStartingLine.Defense,
    }),
    requireOpenPoint: vi.fn().mockImplementation((open: unknown) => {
      if (open === null) {
        throw new MatchPointNotOpenError();
      }
      return open;
    }),
    sequenceFor: vi.fn().mockResolvedValue(4),
    append: vi.fn().mockResolvedValue(play()),
    ...overrides,
  };
  const audit = vi.fn().mockResolvedValue(undefined);
  const enqueue = vi.fn().mockResolvedValue(undefined);
  const lookup = {
    require: vi.fn().mockResolvedValue(match()),
  } as unknown as MatchLookupService;
  return {
    useCase: new CompleteMatchPointUseCase(
      UOW,
      CLOCK,
      ID_GEN,
      lookup,
      stream as unknown as MatchPlayStreamService,
      { record: audit } as unknown as AuditRecorderService,
      { enqueue } as unknown as RecordDomainEventService,
    ),
    stream,
    audit,
    enqueue,
  };
}

describe('CompleteMatchPointUseCase', () => {
  it('closes the open point with the side that scored it', async () => {
    const { useCase, stream } = harness();
    const result = await useCase.execute(ACTOR, 'team-1', 'match-1', {
      content: content(),
    });
    expect(result.outcome).toBe(OperationOutcome.Applied);
    expect(result.pointNumber).toBe(2);
    expect(stream.append.mock.calls[0]?.[1]).toMatchObject({
      playType: MatchPlayType.PointCompleted,
      pointNumber: 2,
      scoringSide: ScoringSide.Us,
    });
  });

  it('keeps an unmeasured point length NULL rather than zero seconds', async () => {
    const { useCase, stream } = harness();
    await useCase.execute(ACTOR, 'team-1', 'match-1', { content: content() });
    expect(stream.append.mock.calls[0]?.[1].durationSeconds).toBeNull();
  });

  it('records a measured point length as the number it was', async () => {
    const { useCase, stream } = harness();
    await useCase.execute(ACTOR, 'team-1', 'match-1', {
      content: content({ durationSeconds: 0 }),
    });
    expect(stream.append.mock.calls[0]?.[1].durationSeconds).toBe(0);
  });

  it('publishes match.point_completed with the classification inputs', async () => {
    const { useCase, enqueue } = harness();
    await useCase.execute(ACTOR, 'team-1', 'match-1', { content: content() });
    const event = enqueue.mock.calls[0]?.[1];
    expect(event.eventType).toBe(POINT_COMPLETED_EVENT);
    expect(event.payload.scoringSide).toBe(ScoringSide.Us);
    expect(event.payload.pointNumber).toBe(2);
  });

  it('refuses to complete when no point is open', async () => {
    const { useCase } = harness({
      findOpenPoint: vi.fn().mockResolvedValue(null),
    });
    await expect(
      useCase.execute(ACTOR, 'team-1', 'match-1', { content: content() }),
    ).rejects.toBeInstanceOf(MatchPointNotOpenError);
  });

  it('returns the stored fact on a replay without appending again', async () => {
    const { useCase, stream, audit } = harness({
      resolveReplay: vi.fn().mockResolvedValue(play()),
    });
    const result = await useCase.execute(ACTOR, 'team-1', 'match-1', {
      content: content(),
    });
    expect(result.outcome).toBe(OperationOutcome.Replayed);
    expect(result.lineup).toEqual([]);
    expect(stream.append).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  it('audits the completion', async () => {
    const { useCase, audit } = harness();
    await useCase.execute(ACTOR, 'team-1', 'match-1', { content: content() });
    expect(audit.mock.calls[0]?.[1].diff.playType).toBe(
      MatchPlayType.PointCompleted,
    );
  });
});
