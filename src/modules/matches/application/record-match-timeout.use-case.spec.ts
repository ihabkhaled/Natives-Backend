import type { AuthUserIdentity } from '@core/auth';
import type { ClockPort } from '@core/clock/clock.port';
import type {
  TransactionScope,
  UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import type { AuditRecorderService } from '@modules/platform';
import { describe, expect, it, vi } from 'vitest';

import { MatchNotScoringError } from '../errors/match-not-scoring.error';
import { MatchTimeoutsExhaustedError } from '../errors/match-timeouts-exhausted.error';
import type { MatchEventRepository } from '../infrastructure/match-event.repository';
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
  TimeoutContent,
} from '../model/matches.types';
import type { MatchLookupService } from './match-lookup.service';
import type { MatchStreamService } from './match-stream.service';
import { RecordMatchTimeoutUseCase } from './record-match-timeout.use-case';

const TX = { run: vi.fn() } as unknown as TransactionScope;
const UOW: UnitOfWorkPort = { runInTransaction: operation => operation(TX) };
const NOW = new Date('2026-03-01T10:00:00.000Z');
const CLOCK = { now: () => NOW } as unknown as ClockPort;
const ID_GEN = { generate: () => 'event-3' };
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
    ourScore: 5,
    opponentScore: 4,
    period: 2,
    streamVersion: 9,
    recordVersion: 6,
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
    timeoutsPerPeriod: 1,
    periods: 2,
    status: RulesetStatus.Active,
    notes: null,
    createdBy: null,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function event(): MatchEvent {
  return {
    eventId: 'event-3',
    matchId: 'match-1',
    teamId: 'team-1',
    sequence: 10,
    operationId: 'op-abcdef02',
    requestHash: 'hash-t',
    eventType: MatchEventType.Timeout,
    scoringSide: ScoringSide.Us,
    points: null,
    ourScoreAfter: 5,
    opponentScoreAfter: 4,
    period: 2,
    scorerMembershipId: null,
    assistMembershipId: null,
    voidsEventId: null,
    voided: false,
    voidReason: null,
    recordedBy: 'keeper-1',
    occurredAt: null,
    recordedAt: NOW,
  };
}

function content(overrides: Partial<TimeoutContent> = {}): TimeoutContent {
  return {
    operationId: 'op-abcdef02',
    scoringSide: ScoringSide.Us,
    occurredAt: null,
    ...overrides,
  };
}

function build(options: {
  replay?: MatchEvent | null;
  usage?: { usedByUs: number; usedByThem: number };
  open?: boolean;
}): {
  useCase: RecordMatchTimeoutUseCase;
  append: ReturnType<typeof vi.fn>;
  advance: ReturnType<typeof vi.fn>;
  countTimeouts: ReturnType<typeof vi.fn>;
  audit: { record: ReturnType<typeof vi.fn> };
} {
  const append = vi.fn().mockResolvedValue(event());
  const advance = vi
    .fn()
    .mockResolvedValue(match({ streamVersion: 10, recordVersion: 7 }));
  const stream = {
    resolveReplay: vi.fn().mockResolvedValue(options.replay ?? null),
    assertOpen: vi.fn().mockImplementation(() => {
      if (options.open === false) {
        throw new MatchNotScoringError();
      }
    }),
    sequenceFor: vi.fn().mockReturnValue(10),
    append,
    advance,
  } as unknown as MatchStreamService;
  const countTimeouts = vi
    .fn()
    .mockResolvedValue(options.usage ?? { usedByUs: 0, usedByThem: 0 });
  const lookup = {
    require: vi.fn().mockResolvedValue(match()),
    requireRuleset: vi.fn().mockResolvedValue(ruleset()),
  } as unknown as MatchLookupService;
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  return {
    useCase: new RecordMatchTimeoutUseCase(
      UOW,
      CLOCK,
      ID_GEN,
      lookup,
      stream,
      { countTimeouts } as unknown as MatchEventRepository,
      audit as unknown as AuditRecorderService,
    ),
    append,
    advance,
    countTimeouts,
    audit,
  };
}

describe('RecordMatchTimeoutUseCase', () => {
  it('records a timeout without moving the score', async () => {
    const { useCase, append } = build({});
    const result = await useCase.execute(ACTOR, 'team-1', 'match-1', {
      content: content(),
    });
    expect(result.outcome).toBe(OperationOutcome.Applied);
    expect(result.ourScore).toBe(5);
    expect(result.opponentScore).toBe(4);
    expect(append.mock.calls[0]?.[1]).toMatchObject({
      eventType: MatchEventType.Timeout,
      points: null,
      ourScoreAfter: 5,
    });
  });

  it('counts the budget of the current period only', async () => {
    const { useCase, countTimeouts } = build({});
    await useCase.execute(ACTOR, 'team-1', 'match-1', { content: content() });
    expect(countTimeouts).toHaveBeenCalledWith(TX, 'match-1', 2);
  });

  it('refuses a side that has spent its ruleset allowance', async () => {
    const { useCase, append } = build({
      usage: { usedByUs: 1, usedByThem: 0 },
    });
    await expect(
      useCase.execute(ACTOR, 'team-1', 'match-1', { content: content() }),
    ).rejects.toBeInstanceOf(MatchTimeoutsExhaustedError);
    expect(append).not.toHaveBeenCalled();
  });

  it('still allows the other side when only one budget is spent', async () => {
    const { useCase, append } = build({
      usage: { usedByUs: 1, usedByThem: 0 },
    });
    await useCase.execute(ACTOR, 'team-1', 'match-1', {
      content: content({ scoringSide: ScoringSide.Them }),
    });
    expect(append).toHaveBeenCalledOnce();
  });

  it('replays a queued retry without appending a second timeout', async () => {
    const stored = event();
    const { useCase, append, advance } = build({ replay: stored });
    const result = await useCase.execute(ACTOR, 'team-1', 'match-1', {
      content: content(),
    });
    expect(result.outcome).toBe(OperationOutcome.Replayed);
    expect(result.event).toBe(stored);
    expect(append).not.toHaveBeenCalled();
    expect(advance).not.toHaveBeenCalled();
  });

  it('refuses a timeout on a match that is not live', async () => {
    const { useCase, append } = build({ open: false });
    await expect(
      useCase.execute(ACTOR, 'team-1', 'match-1', { content: content() }),
    ).rejects.toBeInstanceOf(MatchNotScoringError);
    expect(append).not.toHaveBeenCalled();
  });

  it('audits the timeout append', async () => {
    const { useCase, audit } = build({});
    await useCase.execute(ACTOR, 'team-1', 'match-1', { content: content() });
    expect(audit.record.mock.calls[0]?.[1]).toMatchObject({
      action: 'match.timeout',
    });
  });
});
