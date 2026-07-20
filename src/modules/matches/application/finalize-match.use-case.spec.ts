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

import { MatchFinalizedError } from '../errors/match-finalized.error';
import { MatchInvalidTransitionError } from '../errors/match-invalid-transition.error';
import { MatchOperationConflictError } from '../errors/match-operation-conflict.error';
import { MatchVersionConflictError } from '../errors/match-version-conflict.error';
import type { MatchRepository } from '../infrastructure/match.repository';
import type { MatchRevisionRepository } from '../infrastructure/match-revision.repository';
import {
  CapKind,
  MatchResult,
  MatchRevisionAction,
  MatchStatus,
} from '../model/matches.enums';
import type { Match } from '../model/matches.types';
import { FinalizeMatchUseCase } from './finalize-match.use-case';
import type { MatchLookupService } from './match-lookup.service';

const TX = { run: vi.fn() } as unknown as TransactionScope;
const UOW: UnitOfWorkPort = { runInTransaction: operation => operation(TX) };
const NOW = new Date('2026-03-01T10:00:00.000Z');
const CLOCK = { now: () => NOW } as unknown as ClockPort;
const ID_GEN = { generate: () => 'revision-1' };
const ACTOR: AuthUserIdentity = {
  userId: 'admin-1',
  email: 'admin@example.test',
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
    status: MatchStatus.Completed,
    homeAway: 'home',
    ourScore: 15,
    opponentScore: 12,
    period: 2,
    streamVersion: 27,
    recordVersion: 8,
    revision: 1,
    result: MatchResult.Win,
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
    completedAt: NOW,
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

function build(options: { existing?: Match; finalized?: Match | null }): {
  useCase: FinalizeMatchUseCase;
  applyFinalization: ReturnType<typeof vi.fn>;
  append: ReturnType<typeof vi.fn>;
  events: { enqueue: ReturnType<typeof vi.fn> };
  audit: { record: ReturnType<typeof vi.fn> };
} {
  const finalized =
    'finalized' in options
      ? options.finalized
      : match({
          status: MatchStatus.Finalized,
          finalizedAt: NOW,
          finalizedBy: 'admin-1',
          recordVersion: 9,
        });
  const applyFinalization = vi.fn().mockResolvedValue(finalized);
  const append = vi.fn().mockResolvedValue({ revisionId: 'revision-1' });
  const lookup = {
    require: vi.fn().mockResolvedValue(options.existing ?? match()),
  } as unknown as MatchLookupService;
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  const events = { enqueue: vi.fn().mockResolvedValue(undefined) };
  return {
    useCase: new FinalizeMatchUseCase(
      UOW,
      CLOCK,
      ID_GEN,
      lookup,
      { applyFinalization } as unknown as MatchRepository,
      {
        append,
        nextSequence: vi.fn().mockResolvedValue(1),
      } as unknown as MatchRevisionRepository,
      audit as unknown as AuditRecorderService,
      events as unknown as RecordDomainEventService,
    ),
    applyFinalization,
    append,
    events,
    audit,
  };
}

describe('FinalizeMatchUseCase', () => {
  it('publishes the result derived from the projected score', async () => {
    const { useCase, applyFinalization, events } = build({});
    const published = await useCase.execute(ACTOR, 'team-1', 'match-1', {
      expectedRecordVersion: 8,
      ourScore: null,
      opponentScore: null,
    });
    expect(published.status).toBe(MatchStatus.Finalized);
    expect(applyFinalization.mock.calls[0]?.[1]).toMatchObject({
      result: MatchResult.Win,
      finalizedBy: 'admin-1',
      expectedRecordVersion: 8,
    });
    expect(events.enqueue.mock.calls[0]?.[1]).toMatchObject({
      eventType: 'match.finalized.v1',
      payload: { result: MatchResult.Win, streamVersion: 27 },
    });
  });

  it('appends a first publication as a `finalized` revision', async () => {
    const { useCase, append } = build({});
    await useCase.execute(ACTOR, 'team-1', 'match-1', {
      expectedRecordVersion: 8,
      ourScore: null,
      opponentScore: null,
    });
    expect(append.mock.calls[0]?.[1]).toMatchObject({
      action: MatchRevisionAction.Finalized,
      fromStatus: MatchStatus.Completed,
      toStatus: MatchStatus.Finalized,
      ourScoreBefore: 15,
      opponentScoreBefore: 12,
      streamVersion: 27,
    });
  });

  it('appends a later publication as a `corrected` revision', async () => {
    const { useCase, append } = build({
      existing: match({ revision: 2 }),
      finalized: match({
        status: MatchStatus.Finalized,
        revision: 2,
        finalizedAt: NOW,
      }),
    });
    await useCase.execute(ACTOR, 'team-1', 'match-1', {
      expectedRecordVersion: 8,
      ourScore: null,
      opponentScore: null,
    });
    expect(append.mock.calls[0]?.[1]).toMatchObject({
      action: MatchRevisionAction.Corrected,
      revision: 2,
    });
  });

  it('accepts an asserted score that agrees with the stream', async () => {
    const { useCase, applyFinalization } = build({});
    await useCase.execute(ACTOR, 'team-1', 'match-1', {
      expectedRecordVersion: 8,
      ourScore: 15,
      opponentScore: 12,
    });
    expect(applyFinalization).toHaveBeenCalledOnce();
  });

  it('never merges an asserted score that disagrees with the stream', async () => {
    const { useCase, applyFinalization } = build({});
    await expect(
      useCase.execute(ACTOR, 'team-1', 'match-1', {
        expectedRecordVersion: 8,
        ourScore: 15,
        opponentScore: 11,
      }),
    ).rejects.toBeInstanceOf(MatchOperationConflictError);
    expect(applyFinalization).not.toHaveBeenCalled();
  });

  it('refuses to finalize an already finalized match', async () => {
    const { useCase, applyFinalization } = build({
      existing: match({ status: MatchStatus.Finalized }),
    });
    await expect(
      useCase.execute(ACTOR, 'team-1', 'match-1', {
        expectedRecordVersion: 8,
        ourScore: null,
        opponentScore: null,
      }),
    ).rejects.toBeInstanceOf(MatchFinalizedError);
    expect(applyFinalization).not.toHaveBeenCalled();
  });

  it('refuses to finalize a match that is still being played', async () => {
    const { useCase, applyFinalization } = build({
      existing: match({ status: MatchStatus.Live }),
    });
    await expect(
      useCase.execute(ACTOR, 'team-1', 'match-1', {
        expectedRecordVersion: 8,
        ourScore: null,
        opponentScore: null,
      }),
    ).rejects.toBeInstanceOf(MatchInvalidTransitionError);
    expect(applyFinalization).not.toHaveBeenCalled();
  });

  it('raises a version conflict without recording a revision or event', async () => {
    const { useCase, append, events } = build({ finalized: null });
    await expect(
      useCase.execute(ACTOR, 'team-1', 'match-1', {
        expectedRecordVersion: 99,
        ourScore: null,
        opponentScore: null,
      }),
    ).rejects.toBeInstanceOf(MatchVersionConflictError);
    expect(append).not.toHaveBeenCalled();
    expect(events.enqueue).not.toHaveBeenCalled();
  });

  it('audits the publication', async () => {
    const { useCase, audit } = build({});
    await useCase.execute(ACTOR, 'team-1', 'match-1', {
      expectedRecordVersion: 8,
      ourScore: null,
      opponentScore: null,
    });
    expect(audit.record.mock.calls[0]?.[1]).toMatchObject({
      action: 'match.finalized',
      resourceId: 'match-1',
    });
  });
});
