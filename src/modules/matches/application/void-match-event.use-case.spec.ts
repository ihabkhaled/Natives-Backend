import type { AuthUserIdentity } from '@core/auth';
import type { ClockPort } from '@core/clock/clock.port';
import type {
  TransactionScope,
  UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import type { AuditRecorderService } from '@modules/platform';
import { describe, expect, it, vi } from 'vitest';

import { MatchEventNotFoundError } from '../errors/match-event-not-found.error';
import { MatchNotScoringError } from '../errors/match-not-scoring.error';
import { MatchOperationConflictError } from '../errors/match-operation-conflict.error';
import {
  CapKind,
  MatchEventType,
  MatchResult,
  MatchStatus,
  OperationOutcome,
  RulesetStatus,
  ScoringSide,
} from '../model/matches.enums';
import type {
  Match,
  MatchEvent,
  MatchRuleset,
  VoidContent,
} from '../model/matches.types';
import type { MatchLookupService } from './match-lookup.service';
import type { MatchStreamService } from './match-stream.service';
import { VoidMatchEventUseCase } from './void-match-event.use-case';

const TX = { run: vi.fn() } as unknown as TransactionScope;
const UOW: UnitOfWorkPort = { runInTransaction: operation => operation(TX) };
const NOW = new Date('2026-03-01T10:00:00.000Z');
const CLOCK = { now: () => NOW } as unknown as ClockPort;
const ID_GEN = { generate: () => 'event-9' };
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
    rosterId: null,
    rulesetId: 'rules-1',
    status: MatchStatus.Live,
    homeAway: 'home',
    ourScore: 4,
    opponentScore: 2,
    period: 1,
    streamVersion: 6,
    recordVersion: 5,
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

function ruleset(): MatchRuleset {
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
  };
}

function event(overrides: Partial<MatchEvent> = {}): MatchEvent {
  return {
    eventId: 'event-1',
    matchId: 'match-1',
    teamId: 'team-1',
    sequence: 6,
    operationId: 'op-abcdef01',
    requestHash: 'hash-a',
    eventType: MatchEventType.Point,
    scoringSide: ScoringSide.Us,
    points: 1,
    ourScoreAfter: 4,
    opponentScoreAfter: 2,
    period: 1,
    scorerMembershipId: null,
    assistMembershipId: null,
    voidsEventId: null,
    voided: false,
    voidReason: null,
    recordedBy: 'keeper-1',
    occurredAt: null,
    recordedAt: NOW,
    ...overrides,
  };
}

function content(overrides: Partial<VoidContent> = {}): VoidContent {
  return {
    operationId: 'op-abcdef09',
    eventId: 'event-1',
    reason: 'credited to the wrong side',
    ...overrides,
  };
}

function build(options: {
  replay?: MatchEvent | null;
  target?: MatchEvent | null;
  open?: boolean;
  updated?: Match;
}): {
  useCase: VoidMatchEventUseCase;
  append: ReturnType<typeof vi.fn>;
  advance: ReturnType<typeof vi.fn>;
  audit: { record: ReturnType<typeof vi.fn> };
} {
  const append = vi
    .fn()
    .mockResolvedValue(
      event({ eventId: 'event-9', eventType: MatchEventType.Void }),
    );
  const advance = vi
    .fn()
    .mockResolvedValue(
      options.updated ?? match({ ourScore: 3, streamVersion: 7 }),
    );
  const stream = {
    resolveReplay: vi.fn().mockResolvedValue(options.replay ?? null),
    assertOpen: vi.fn().mockImplementation(() => {
      if (options.open === false) {
        throw new MatchNotScoringError();
      }
    }),
    findEvent: vi
      .fn()
      .mockResolvedValue('target' in options ? options.target : event()),
    sequenceFor: vi.fn().mockReturnValue(7),
    append,
    advance,
  } as unknown as MatchStreamService;
  const lookup = {
    require: vi.fn().mockResolvedValue(match()),
    requireRuleset: vi.fn().mockResolvedValue(ruleset()),
  } as unknown as MatchLookupService;
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  return {
    useCase: new VoidMatchEventUseCase(
      UOW,
      CLOCK,
      ID_GEN,
      lookup,
      stream,
      audit as unknown as AuditRecorderService,
    ),
    append,
    advance,
    audit,
  };
}

describe('VoidMatchEventUseCase', () => {
  it('appends a compensating void and reverts the point it undoes', async () => {
    const { useCase, append } = build({});
    const result = await useCase.execute(ACTOR, 'team-1', 'match-1', {
      content: content(),
    });
    expect(result.outcome).toBe(OperationOutcome.Applied);
    expect(result.ourScore).toBe(3);
    expect(append.mock.calls[0]?.[1]).toMatchObject({
      eventType: MatchEventType.Void,
      voidsEventId: 'event-1',
      voidReason: 'credited to the wrong side',
      ourScoreAfter: 3,
      opponentScoreAfter: 2,
    });
  });

  it('reverts an opponent point off the opponent total only', async () => {
    const { useCase, append } = build({
      target: event({ scoringSide: ScoringSide.Them, points: 2 }),
    });
    await useCase.execute(ACTOR, 'team-1', 'match-1', { content: content() });
    expect(append.mock.calls[0]?.[1]).toMatchObject({
      ourScoreAfter: 4,
      opponentScoreAfter: 0,
    });
  });

  it('leaves the score untouched when voiding a non-scoring fact', async () => {
    const { useCase, append } = build({
      target: event({
        eventType: MatchEventType.Timeout,
        scoringSide: ScoringSide.Us,
        points: null,
      }),
    });
    await useCase.execute(ACTOR, 'team-1', 'match-1', { content: content() });
    expect(append.mock.calls[0]?.[1]).toMatchObject({
      ourScoreAfter: 4,
      opponentScoreAfter: 2,
    });
  });

  it('leaves the score untouched when a point fact carries no side', async () => {
    const { useCase, append } = build({
      target: event({ scoringSide: null }),
    });
    await useCase.execute(ACTOR, 'team-1', 'match-1', { content: content() });
    expect(append.mock.calls[0]?.[1]).toMatchObject({ ourScoreAfter: 4 });
  });

  it('leaves the score untouched when a point fact carries no value', async () => {
    const { useCase, append } = build({ target: event({ points: null }) });
    await useCase.execute(ACTOR, 'team-1', 'match-1', { content: content() });
    expect(append.mock.calls[0]?.[1]).toMatchObject({ ourScoreAfter: 4 });
  });

  it('refuses to void a fact that is not on this match', async () => {
    const { useCase, append } = build({ target: null });
    await expect(
      useCase.execute(ACTOR, 'team-1', 'match-1', { content: content() }),
    ).rejects.toBeInstanceOf(MatchEventNotFoundError);
    expect(append).not.toHaveBeenCalled();
  });

  it('refuses to void a fact a previous void already compensated', async () => {
    const { useCase, append } = build({ target: event({ voided: true }) });
    await expect(
      useCase.execute(ACTOR, 'team-1', 'match-1', { content: content() }),
    ).rejects.toBeInstanceOf(MatchOperationConflictError);
    expect(append).not.toHaveBeenCalled();
  });

  it('refuses a void on a match that is not live', async () => {
    const { useCase, append } = build({ open: false });
    await expect(
      useCase.execute(ACTOR, 'team-1', 'match-1', { content: content() }),
    ).rejects.toBeInstanceOf(MatchNotScoringError);
    expect(append).not.toHaveBeenCalled();
  });

  it('replays a queued retry without appending a second void', async () => {
    const stored = event({ eventType: MatchEventType.Void });
    const { useCase, append, advance } = build({ replay: stored });
    const result = await useCase.execute(ACTOR, 'team-1', 'match-1', {
      content: content(),
    });
    expect(result.outcome).toBe(OperationOutcome.Replayed);
    expect(result.event).toBe(stored);
    expect(append).not.toHaveBeenCalled();
    expect(advance).not.toHaveBeenCalled();
  });

  it('audits the void append', async () => {
    const { useCase, audit } = build({});
    await useCase.execute(ACTOR, 'team-1', 'match-1', { content: content() });
    expect(audit.record.mock.calls[0]?.[1]).toMatchObject({
      action: 'match.event.voided',
    });
  });
});
