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

import { MatchOperationConflictError } from '../errors/match-operation-conflict.error';
import { MatchPlayNotFoundError } from '../errors/match-play-not-found.error';
import { MATCH_EVENT_CORRECTED_EVENT } from '../model/matches.constants';
import {
  CapKind,
  MatchPlayType,
  MatchResult,
  MatchStatus,
  OperationOutcome,
} from '../model/matches.enums';
import type {
  CorrectionContent,
  Match,
  MatchPlayEvent,
} from '../model/matches.types';
import { CorrectMatchPlayUseCase } from './correct-match-play.use-case';
import type { MatchLookupService } from './match-lookup.service';
import type { MatchPlayStreamService } from './match-play-stream.service';

const TX = { run: vi.fn() } as unknown as TransactionScope;
const UOW: UnitOfWorkPort = { runInTransaction: operation => operation(TX) };
const NOW = new Date('2026-05-01T10:00:00.000Z');
const CLOCK = { now: () => NOW } as unknown as ClockPort;
const ID_GEN = { generate: () => 'fix-1' };
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
    playId: 'goal-1',
    matchId: 'match-1',
    teamId: 'team-1',
    sequence: 3,
    operationId: 'op-goal',
    requestHash: 'hash-goal',
    playType: MatchPlayType.Goal,
    pointNumber: 2,
    period: 1,
    startingLine: null,
    scoringSide: null,
    primaryMembershipId: 'ana',
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

function correction(): MatchPlayEvent {
  return play({
    playId: 'fix-1',
    sequence: 4,
    operationId: 'op-fix',
    playType: MatchPlayType.Correction,
    primaryMembershipId: null,
    correctsPlayId: 'goal-1',
    correctionReason: 'credited to the wrong player',
  });
}

function content(
  overrides: Partial<CorrectionContent> = {},
): CorrectionContent {
  return {
    operationId: 'op-fix',
    playId: 'goal-1',
    reason: 'credited to the wrong player',
    ...overrides,
  };
}

interface Harness {
  readonly useCase: CorrectMatchPlayUseCase;
  readonly stream: Record<string, ReturnType<typeof vi.fn>>;
  readonly audit: ReturnType<typeof vi.fn>;
  readonly enqueue: ReturnType<typeof vi.fn>;
}

function harness(overrides: Partial<Record<string, unknown>> = {}): Harness {
  const stream = {
    resolveReplay: vi.fn().mockResolvedValue(null),
    assertOpen: vi.fn(),
    requirePlay: vi.fn().mockResolvedValue(play()),
    sequenceFor: vi.fn().mockResolvedValue(4),
    append: vi.fn().mockResolvedValue(correction()),
    ...overrides,
  };
  const audit = vi.fn().mockResolvedValue(undefined);
  const enqueue = vi.fn().mockResolvedValue(undefined);
  const lookup = {
    require: vi.fn().mockResolvedValue(match()),
  } as unknown as MatchLookupService;
  return {
    useCase: new CorrectMatchPlayUseCase(
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

describe('CorrectMatchPlayUseCase', () => {
  it('appends a compensating retraction instead of rewriting history', async () => {
    const { useCase, stream } = harness();
    const result = await useCase.execute(ACTOR, 'team-1', 'match-1', {
      content: content(),
    });
    expect(result.outcome).toBe(OperationOutcome.Applied);
    expect(stream.append.mock.calls[0]?.[1]).toMatchObject({
      playType: MatchPlayType.Correction,
      correctsPlayId: 'goal-1',
      correctionReason: 'credited to the wrong player',
      pointNumber: 2,
    });
  });

  it('reports an unknown target as not found', async () => {
    const { useCase } = harness({
      requirePlay: vi.fn().mockRejectedValue(new MatchPlayNotFoundError()),
    });
    await expect(
      useCase.execute(ACTOR, 'team-1', 'match-1', { content: content() }),
    ).rejects.toBeInstanceOf(MatchPlayNotFoundError);
  });

  it('refuses to retract a fact twice', async () => {
    const { useCase } = harness({
      requirePlay: vi.fn().mockRejectedValue(new MatchOperationConflictError()),
    });
    await expect(
      useCase.execute(ACTOR, 'team-1', 'match-1', { content: content() }),
    ).rejects.toBeInstanceOf(MatchOperationConflictError);
  });

  it('publishes match.event_corrected naming what was retracted', async () => {
    const { useCase, enqueue } = harness();
    await useCase.execute(ACTOR, 'team-1', 'match-1', { content: content() });
    const event = enqueue.mock.calls[0]?.[1];
    expect(event.eventType).toBe(MATCH_EVENT_CORRECTED_EVENT);
    expect(event.payload.correctsPlayId).toBe('goal-1');
    expect(event.payload.correctedPlayType).toBe(MatchPlayType.Goal);
  });

  it('returns the stored retraction on a replay without appending again', async () => {
    const { useCase, stream } = harness({
      resolveReplay: vi.fn().mockResolvedValue(correction()),
    });
    const result = await useCase.execute(ACTOR, 'team-1', 'match-1', {
      content: content(),
    });
    expect(result.outcome).toBe(OperationOutcome.Replayed);
    expect(stream.append).not.toHaveBeenCalled();
  });

  it('guards the scoring window before retracting', async () => {
    const { useCase, stream } = harness();
    await useCase.execute(ACTOR, 'team-1', 'match-1', { content: content() });
    expect(stream.assertOpen).toHaveBeenCalledTimes(1);
  });

  it('audits the retraction with the fact it points at', async () => {
    const { useCase, audit } = harness();
    await useCase.execute(ACTOR, 'team-1', 'match-1', { content: content() });
    expect(audit.mock.calls[0]?.[1].diff.correctsPlayId).toBe('goal-1');
  });
});
