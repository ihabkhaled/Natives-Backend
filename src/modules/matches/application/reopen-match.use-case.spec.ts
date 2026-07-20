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

import { MatchReopenNotAllowedError } from '../errors/match-reopen-not-allowed.error';
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
import type { MatchLookupService } from './match-lookup.service';
import { ReopenMatchUseCase } from './reopen-match.use-case';

const TX = { run: vi.fn() } as unknown as TransactionScope;
const UOW: UnitOfWorkPort = { runInTransaction: operation => operation(TX) };
const NOW = new Date('2026-03-01T10:00:00.000Z');
const CLOCK = { now: () => NOW } as unknown as ClockPort;
const ID_GEN = { generate: () => 'revision-2' };
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
    status: MatchStatus.Finalized,
    homeAway: 'home',
    ourScore: 15,
    opponentScore: 12,
    period: 2,
    streamVersion: 27,
    recordVersion: 9,
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
    finalizedBy: 'admin-1',
    finalizedAt: NOW,
    abandonedAt: null,
    abandonReason: null,
    notes: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function build(options: { existing?: Match; reopened?: Match | null }): {
  useCase: ReopenMatchUseCase;
  applyReopening: ReturnType<typeof vi.fn>;
  append: ReturnType<typeof vi.fn>;
  events: { enqueue: ReturnType<typeof vi.fn> };
  audit: { record: ReturnType<typeof vi.fn> };
} {
  const reopened =
    'reopened' in options
      ? options.reopened
      : match({
          status: MatchStatus.Live,
          revision: 2,
          result: MatchResult.Undecided,
          reopenReason: 'wrong side credited',
          reopenedBy: 'admin-1',
          reopenedAt: NOW,
          finalizedAt: null,
          finalizedBy: null,
          recordVersion: 10,
        });
  const applyReopening = vi.fn().mockResolvedValue(reopened);
  const append = vi.fn().mockResolvedValue({ revisionId: 'revision-2' });
  const lookup = {
    require: vi.fn().mockResolvedValue(options.existing ?? match()),
  } as unknown as MatchLookupService;
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  const events = { enqueue: vi.fn().mockResolvedValue(undefined) };
  return {
    useCase: new ReopenMatchUseCase(
      UOW,
      CLOCK,
      ID_GEN,
      lookup,
      { applyReopening } as unknown as MatchRepository,
      {
        append,
        nextSequence: vi.fn().mockResolvedValue(1),
      } as unknown as MatchRevisionRepository,
      audit as unknown as AuditRecorderService,
      events as unknown as RecordDomainEventService,
    ),
    applyReopening,
    append,
    events,
    audit,
  };
}

describe('ReopenMatchUseCase', () => {
  it('reopens a finalized match by bumping the revision, never editing it', async () => {
    const { useCase, applyReopening } = build({});
    const reopened = await useCase.execute(ACTOR, 'team-1', 'match-1', {
      reason: 'wrong side credited',
      expectedRecordVersion: 9,
    });
    expect(reopened.status).toBe(MatchStatus.Live);
    expect(reopened.revision).toBe(2);
    expect(applyReopening.mock.calls[0]?.[1]).toMatchObject({
      revision: 2,
      reason: 'wrong side credited',
      reopenedBy: 'admin-1',
      expectedRecordVersion: 9,
    });
  });

  it('appends an immutable revision carrying the score as published', async () => {
    const { useCase, append } = build({});
    await useCase.execute(ACTOR, 'team-1', 'match-1', {
      reason: 'wrong side credited',
      expectedRecordVersion: 9,
    });
    expect(append.mock.calls[0]?.[1]).toMatchObject({
      action: MatchRevisionAction.Reopened,
      reason: 'wrong side credited',
      fromStatus: MatchStatus.Finalized,
      toStatus: MatchStatus.Live,
      ourScoreBefore: 15,
      opponentScoreBefore: 12,
      revision: 2,
    });
  });

  it('publishes match.reopened with the score as it was published', async () => {
    const { useCase, events } = build({});
    await useCase.execute(ACTOR, 'team-1', 'match-1', {
      reason: 'wrong side credited',
      expectedRecordVersion: 9,
    });
    expect(events.enqueue.mock.calls[0]?.[1]).toMatchObject({
      eventType: 'match.reopened.v1',
      payload: {
        previousOurScore: 15,
        previousOpponentScore: 12,
        revision: 2,
      },
    });
  });

  it('refuses to reopen a match that was never finalized', async () => {
    const { useCase, applyReopening } = build({
      existing: match({ status: MatchStatus.Completed }),
    });
    await expect(
      useCase.execute(ACTOR, 'team-1', 'match-1', {
        reason: 'too early',
        expectedRecordVersion: 9,
      }),
    ).rejects.toBeInstanceOf(MatchReopenNotAllowedError);
    expect(applyReopening).not.toHaveBeenCalled();
  });

  it('raises a version conflict without recording a revision or event', async () => {
    const { useCase, append, events } = build({ reopened: null });
    await expect(
      useCase.execute(ACTOR, 'team-1', 'match-1', {
        reason: 'wrong side credited',
        expectedRecordVersion: 99,
      }),
    ).rejects.toBeInstanceOf(MatchVersionConflictError);
    expect(append).not.toHaveBeenCalled();
    expect(events.enqueue).not.toHaveBeenCalled();
  });

  it('audits the reopening', async () => {
    const { useCase, audit } = build({});
    await useCase.execute(ACTOR, 'team-1', 'match-1', {
      reason: 'wrong side credited',
      expectedRecordVersion: 9,
    });
    expect(audit.record.mock.calls[0]?.[1]).toMatchObject({
      action: 'match.reopened',
      resourceId: 'match-1',
    });
  });
});
