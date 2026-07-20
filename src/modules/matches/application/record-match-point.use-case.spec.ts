import type { AuthUserIdentity } from '@core/auth';
import type { ClockPort } from '@core/clock/clock.port';
import type {
  TransactionScope,
  UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import type { AuditRecorderService } from '@modules/platform';
import { describe, expect, it, vi } from 'vitest';

import { MatchNotScoringError } from '../errors/match-not-scoring.error';
import { MatchOperationConflictError } from '../errors/match-operation-conflict.error';
import { MatchScopeNotFoundError } from '../errors/match-scope-not-found.error';
import { MatchVersionConflictError } from '../errors/match-version-conflict.error';
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
  PointContent,
} from '../model/matches.types';
import type { MatchLookupService } from './match-lookup.service';
import type { MatchScopeService } from './match-scope.service';
import type { MatchStreamService } from './match-stream.service';
import { RecordMatchPointUseCase } from './record-match-point.use-case';

const TX = { run: vi.fn() } as unknown as TransactionScope;
const UOW: UnitOfWorkPort = { runInTransaction: operation => operation(TX) };
const NOW = new Date('2026-03-01T10:00:00.000Z');
const CLOCK = { now: () => NOW } as unknown as ClockPort;
const ID_GEN = { generate: () => 'event-2' };
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
    ourScore: 3,
    opponentScore: 2,
    period: 1,
    streamVersion: 5,
    recordVersion: 4,
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
    hardCap: 17,
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
    eventId: 'event-2',
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

function content(overrides: Partial<PointContent> = {}): PointContent {
  return {
    operationId: 'op-abcdef01',
    scoringSide: ScoringSide.Us,
    points: 1,
    scorerMembershipId: null,
    assistMembershipId: null,
    occurredAt: null,
    expectedStreamVersion: null,
    ...overrides,
  };
}

function build(options: {
  existing?: Match;
  replay?: MatchEvent | null;
  scopeOk?: boolean;
  open?: boolean;
  versionOk?: boolean;
  advanceOk?: boolean;
}): {
  useCase: RecordMatchPointUseCase;
  append: ReturnType<typeof vi.fn>;
  advance: ReturnType<typeof vi.fn>;
  audit: { record: ReturnType<typeof vi.fn> };
} {
  // The append echoes the fact the use case built, so the projection under test
  // is driven by the real score the domain computed rather than a fixed stub.
  const append = vi
    .fn()
    .mockImplementation(
      (
        _tx: unknown,
        built: { ourScoreAfter: number; opponentScoreAfter: number },
      ) =>
        Promise.resolve(
          event({
            ourScoreAfter: built.ourScoreAfter,
            opponentScoreAfter: built.opponentScoreAfter,
          }),
        ),
    );
  const advance = vi.fn().mockImplementation(() => {
    if (options.advanceOk === false) {
      throw new MatchVersionConflictError();
    }
    return Promise.resolve(
      match({ ourScore: 4, streamVersion: 6, recordVersion: 5 }),
    );
  });
  const stream = {
    resolveReplay: vi.fn().mockResolvedValue(options.replay ?? null),
    assertOpen: vi.fn().mockImplementation(() => {
      if (options.open === false) {
        throw new MatchNotScoringError();
      }
    }),
    assertStreamVersion: vi.fn().mockImplementation(() => {
      if (options.versionOk === false) {
        throw new MatchVersionConflictError();
      }
    }),
    sequenceFor: vi.fn().mockReturnValue(6),
    append,
    advance,
  } as unknown as MatchStreamService;
  const lookup = {
    require: vi.fn().mockResolvedValue(options.existing ?? match()),
    requireRuleset: vi.fn().mockResolvedValue(ruleset()),
  } as unknown as MatchLookupService;
  const scope = {
    requireMembership: vi.fn().mockImplementation(() => {
      if (options.scopeOk === false) {
        throw new MatchScopeNotFoundError();
      }
      return Promise.resolve(undefined);
    }),
  } as unknown as MatchScopeService;
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  return {
    useCase: new RecordMatchPointUseCase(
      UOW,
      CLOCK,
      ID_GEN,
      lookup,
      scope,
      stream,
      audit as unknown as AuditRecorderService,
    ),
    append,
    advance,
    audit,
  };
}

describe('RecordMatchPointUseCase', () => {
  it('applies a new point and returns the authoritative score', async () => {
    const { useCase, append } = build({});
    const result = await useCase.execute(ACTOR, 'team-1', 'match-1', {
      content: content(),
    });
    expect(result.outcome).toBe(OperationOutcome.Applied);
    expect(result.ourScore).toBe(4);
    expect(result.streamVersion).toBe(6);
    expect(append.mock.calls[0]?.[1]).toMatchObject({
      sequence: 6,
      ourScoreAfter: 4,
      opponentScoreAfter: 2,
      scoringSide: ScoringSide.Us,
    });
  });

  it('replays a queued retry without appending a second fact', async () => {
    const stored = event();
    const { useCase, append, advance } = build({ replay: stored });
    const result = await useCase.execute(ACTOR, 'team-1', 'match-1', {
      content: content(),
    });
    expect(result.outcome).toBe(OperationOutcome.Replayed);
    expect(result.event).toBe(stored);
    expect(result.ourScore).toBe(3);
    expect(result.streamVersion).toBe(5);
    expect(append).not.toHaveBeenCalled();
    expect(advance).not.toHaveBeenCalled();
  });

  it('refuses a score event on a match that is not live', async () => {
    const { useCase, append } = build({ open: false });
    await expect(
      useCase.execute(ACTOR, 'team-1', 'match-1', { content: content() }),
    ).rejects.toBeInstanceOf(MatchNotScoringError);
    expect(append).not.toHaveBeenCalled();
  });

  it('refuses a stale base stream version from an offline device', async () => {
    const { useCase, append } = build({ versionOk: false });
    await expect(
      useCase.execute(ACTOR, 'team-1', 'match-1', {
        content: content({ expectedStreamVersion: 2 }),
      }),
    ).rejects.toBeInstanceOf(MatchVersionConflictError);
    expect(append).not.toHaveBeenCalled();
  });

  it('refuses a scorer who is not a member of the team', async () => {
    const { useCase, append } = build({ scopeOk: false });
    await expect(
      useCase.execute(ACTOR, 'team-1', 'match-1', {
        content: content({ scorerMembershipId: 'member-9' }),
      }),
    ).rejects.toBeInstanceOf(MatchScopeNotFoundError);
    expect(append).not.toHaveBeenCalled();
  });

  it('surfaces a concurrent stream advance as a conflict', async () => {
    const { useCase } = build({ advanceOk: false });
    await expect(
      useCase.execute(ACTOR, 'team-1', 'match-1', { content: content() }),
    ).rejects.toBeInstanceOf(MatchVersionConflictError);
  });

  it('scores the opponent side without touching our total', async () => {
    const { useCase, append } = build({});
    await useCase.execute(ACTOR, 'team-1', 'match-1', {
      content: content({ scoringSide: ScoringSide.Them, points: 2 }),
    });
    expect(append.mock.calls[0]?.[1]).toMatchObject({
      ourScoreAfter: 3,
      opponentScoreAfter: 4,
    });
  });

  it('re-evaluates the cap from the versioned ruleset on every point', async () => {
    const { useCase, advance } = build({
      existing: match({ ourScore: 16, opponentScore: 5 }),
    });
    await useCase.execute(ACTOR, 'team-1', 'match-1', {
      content: content(),
    });
    expect(advance.mock.calls[0]?.[4]).toBe(CapKind.Hard);
  });

  it('audits the append by operation id', async () => {
    const { useCase, audit } = build({});
    await useCase.execute(ACTOR, 'team-1', 'match-1', { content: content() });
    expect(audit.record.mock.calls[0]?.[1]).toMatchObject({
      action: 'match.scored',
      diff: { operationId: 'op-abcdef01' },
    });
  });

  it('bubbles a conflicting operation id straight out of the probe', async () => {
    const { useCase, append } = build({});
    const stream = {
      resolveReplay: vi
        .fn()
        .mockRejectedValue(new MatchOperationConflictError()),
    };
    const failing = new RecordMatchPointUseCase(
      UOW,
      CLOCK,
      ID_GEN,
      {
        require: vi.fn().mockResolvedValue(match()),
        requireRuleset: vi.fn(),
      } as unknown as MatchLookupService,
      { requireMembership: vi.fn() } as unknown as MatchScopeService,
      stream as unknown as MatchStreamService,
      { record: vi.fn() } as unknown as AuditRecorderService,
    );
    await expect(
      failing.execute(ACTOR, 'team-1', 'match-1', { content: content() }),
    ).rejects.toBeInstanceOf(MatchOperationConflictError);
    expect(append).not.toHaveBeenCalled();
    expect(useCase).toBeDefined();
  });
});
