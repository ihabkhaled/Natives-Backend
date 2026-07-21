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
import { MatchScopeNotFoundError } from '../errors/match-scope-not-found.error';
import { MatchValidationError } from '../errors/match-validation.error';
import { MATCH_EVENT_ACCEPTED_EVENT } from '../model/matches.constants';
import {
  AssistState,
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
  PlayContent,
} from '../model/matches.types';
import type { MatchLookupService } from './match-lookup.service';
import type { MatchPlayStreamService } from './match-play-stream.service';
import type { MatchScopeService } from './match-scope.service';
import { RecordMatchPlayUseCase } from './record-match-play.use-case';

const TX = { run: vi.fn() } as unknown as TransactionScope;
const UOW: UnitOfWorkPort = { runInTransaction: operation => operation(TX) };
const NOW = new Date('2026-05-01T10:00:00.000Z');
const CLOCK = { now: () => NOW } as unknown as ClockPort;
const ID_GEN = { generate: () => 'goal-1' };
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
    operationId: 'op-1',
    requestHash: 'hash-1',
    playType: MatchPlayType.Goal,
    pointNumber: 2,
    period: 1,
    startingLine: null,
    scoringSide: null,
    primaryMembershipId: 'ana',
    secondaryMembershipId: 'bo',
    assistState: AssistState.Recorded,
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

function content(overrides: Partial<PlayContent> = {}): PlayContent {
  return {
    operationId: 'op-1',
    playType: MatchPlayType.Goal,
    primaryMembershipId: 'ana',
    secondaryMembershipId: 'bo',
    assistState: AssistState.Recorded,
    callahan: false,
    occurredAt: null,
    notes: null,
    ...overrides,
  };
}

interface Harness {
  readonly useCase: RecordMatchPlayUseCase;
  readonly stream: Record<string, ReturnType<typeof vi.fn>>;
  readonly requireMembership: ReturnType<typeof vi.fn>;
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
      startingLine: PointStartingLine.Offense,
    }),
    requireOpenPoint: vi.fn().mockImplementation((open: unknown) => {
      if (open === null) {
        throw new MatchPointNotOpenError();
      }
      return open;
    }),
    sequenceFor: vi.fn().mockResolvedValue(3),
    append: vi.fn().mockResolvedValue(play()),
    ...overrides,
  };
  const requireMembership = vi.fn().mockResolvedValue(undefined);
  const audit = vi.fn().mockResolvedValue(undefined);
  const enqueue = vi.fn().mockResolvedValue(undefined);
  const lookup = {
    require: vi.fn().mockResolvedValue(match()),
  } as unknown as MatchLookupService;
  return {
    useCase: new RecordMatchPlayUseCase(
      UOW,
      CLOCK,
      ID_GEN,
      lookup,
      stream as unknown as MatchPlayStreamService,
      { requireMembership } as unknown as MatchScopeService,
      { record: audit } as unknown as AuditRecorderService,
      { enqueue } as unknown as RecordDomainEventService,
    ),
    stream,
    requireMembership,
    audit,
    enqueue,
  };
}

describe('RecordMatchPlayUseCase', () => {
  it('appends a possession fact to the open point', async () => {
    const { useCase, stream } = harness();
    const result = await useCase.execute(ACTOR, 'team-1', 'match-1', {
      content: content(),
    });
    expect(result.outcome).toBe(OperationOutcome.Applied);
    expect(result.pointNumber).toBe(2);
    expect(stream.append.mock.calls[0]?.[1]).toMatchObject({
      playType: MatchPlayType.Goal,
      pointNumber: 2,
      primaryMembershipId: 'ana',
      secondaryMembershipId: 'bo',
      assistState: AssistState.Recorded,
    });
  });

  it('drops an assist target when the assist was not recorded', async () => {
    const { useCase, stream } = harness();
    await useCase.execute(ACTOR, 'team-1', 'match-1', {
      content: content({
        assistState: AssistState.None,
        callahan: true,
      }),
    });
    const appended = stream.append.mock.calls[0]?.[1];
    expect(appended.secondaryMembershipId).toBeNull();
    expect(appended.callahan).toBe(true);
  });

  it('rejects an envelope play type on the possession endpoint', async () => {
    const { useCase, stream } = harness();
    await expect(
      useCase.execute(ACTOR, 'team-1', 'match-1', {
        content: content({ playType: MatchPlayType.PointStarted }),
      }),
    ).rejects.toBeInstanceOf(MatchValidationError);
    expect(stream.append).not.toHaveBeenCalled();
  });

  it('checks both named players against the team', async () => {
    const { useCase, requireMembership } = harness();
    await useCase.execute(ACTOR, 'team-1', 'match-1', { content: content() });
    expect(requireMembership).toHaveBeenCalledWith(TX, 'team-1', 'ana');
    expect(requireMembership).toHaveBeenCalledWith(TX, 'team-1', 'bo');
  });

  it('hides a player from another team behind a not-found scope', async () => {
    const { useCase, requireMembership, stream } = harness();
    requireMembership.mockRejectedValueOnce(new MatchScopeNotFoundError());
    await expect(
      useCase.execute(ACTOR, 'team-1', 'match-1', { content: content() }),
    ).rejects.toBeInstanceOf(MatchScopeNotFoundError);
    expect(stream.append).not.toHaveBeenCalled();
  });

  it('refuses a possession fact when no point is open', async () => {
    const { useCase } = harness({
      findOpenPoint: vi.fn().mockResolvedValue(null),
    });
    await expect(
      useCase.execute(ACTOR, 'team-1', 'match-1', { content: content() }),
    ).rejects.toBeInstanceOf(MatchPointNotOpenError);
  });

  it('publishes match.event_accepted for the appended fact', async () => {
    const { useCase, enqueue } = harness();
    await useCase.execute(ACTOR, 'team-1', 'match-1', { content: content() });
    const event = enqueue.mock.calls[0]?.[1];
    expect(event.eventType).toBe(MATCH_EVENT_ACCEPTED_EVENT);
    expect(event.payload.playType).toBe(MatchPlayType.Goal);
    expect(JSON.stringify(event.payload)).not.toContain('ana');
  });

  it('returns the stored fact on a replay without appending again', async () => {
    const { useCase, stream, audit } = harness({
      resolveReplay: vi.fn().mockResolvedValue(play()),
    });
    const result = await useCase.execute(ACTOR, 'team-1', 'match-1', {
      content: content(),
    });
    expect(result.outcome).toBe(OperationOutcome.Replayed);
    expect(stream.append).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  it('audits the recorded fact', async () => {
    const { useCase, audit } = harness();
    await useCase.execute(ACTOR, 'team-1', 'match-1', { content: content() });
    expect(audit.mock.calls[0]?.[1].diff.playType).toBe(MatchPlayType.Goal);
  });
});
