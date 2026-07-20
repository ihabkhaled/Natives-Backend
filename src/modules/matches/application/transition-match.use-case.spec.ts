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
import { MatchValidationError } from '../errors/match-validation.error';
import { MatchVersionConflictError } from '../errors/match-version-conflict.error';
import type { MatchRepository } from '../infrastructure/match.repository';
import {
  CapKind,
  MatchResult,
  MatchStatus,
  MatchTransition,
} from '../model/matches.enums';
import type { Match } from '../model/matches.types';
import type { MatchLookupService } from './match-lookup.service';
import { TransitionMatchUseCase } from './transition-match.use-case';

const TX = { run: vi.fn() } as unknown as TransactionScope;
const UOW: UnitOfWorkPort = { runInTransaction: operation => operation(TX) };
const NOW = new Date('2026-03-01T10:00:00.000Z');
const CLOCK = { now: () => NOW } as unknown as ClockPort;
const ACTOR: AuthUserIdentity = {
  userId: 'coach-1',
  email: 'coach@example.test',
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
    status: MatchStatus.Ready,
    homeAway: 'home',
    ourScore: 0,
    opponentScore: 0,
    period: 1,
    streamVersion: 0,
    recordVersion: 2,
    revision: 1,
    result: MatchResult.Undecided,
    capApplied: CapKind.None,
    engineVersion: 'match-scoring-v1',
    supersedesMatchId: null,
    reopenReason: null,
    reopenedBy: null,
    reopenedAt: null,
    createdBy: 'coach-1',
    startedAt: null,
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

function build(options: { existing?: Match; changed?: Match | null }): {
  useCase: TransitionMatchUseCase;
  applyStatusChange: ReturnType<typeof vi.fn>;
  events: { enqueue: ReturnType<typeof vi.fn> };
  audit: { record: ReturnType<typeof vi.fn> };
} {
  const changed =
    'changed' in options
      ? options.changed
      : match({ status: MatchStatus.Live, startedAt: NOW, recordVersion: 3 });
  const applyStatusChange = vi.fn().mockResolvedValue(changed);
  const lookup = {
    require: vi.fn().mockResolvedValue(options.existing ?? match()),
  } as unknown as MatchLookupService;
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  const events = { enqueue: vi.fn().mockResolvedValue(undefined) };
  return {
    useCase: new TransitionMatchUseCase(
      UOW,
      CLOCK,
      lookup,
      { applyStatusChange } as unknown as MatchRepository,
      audit as unknown as AuditRecorderService,
      events as unknown as RecordDomainEventService,
    ),
    applyStatusChange,
    events,
    audit,
  };
}

describe('TransitionMatchUseCase', () => {
  it('starts a ready match and publishes started plus state_changed', async () => {
    const { useCase, events } = build({});
    const started = await useCase.execute(ACTOR, 'team-1', 'match-1', {
      transition: MatchTransition.Start,
      expectedRecordVersion: 2,
      reason: null,
    });
    expect(started.status).toBe(MatchStatus.Live);
    expect(events.enqueue.mock.calls[0]?.[1]).toMatchObject({
      eventType: 'match.started.v1',
    });
    expect(events.enqueue.mock.calls[1]?.[1]).toMatchObject({
      eventType: 'match.state_changed.v1',
      payload: { fromStatus: MatchStatus.Ready, toStatus: MatchStatus.Live },
    });
  });

  it('publishes only state_changed for a non-start transition', async () => {
    const { useCase, events } = build({
      existing: match({ status: MatchStatus.Live, startedAt: NOW }),
      changed: match({ status: MatchStatus.Paused, startedAt: NOW }),
    });
    await useCase.execute(ACTOR, 'team-1', 'match-1', {
      transition: MatchTransition.Pause,
      expectedRecordVersion: 2,
      reason: null,
    });
    expect(events.enqueue).toHaveBeenCalledOnce();
    expect(events.enqueue.mock.calls[0]?.[1]).toMatchObject({
      eventType: 'match.state_changed.v1',
    });
  });

  it('refuses any plain transition on a finalized match', async () => {
    const { useCase, applyStatusChange } = build({
      existing: match({ status: MatchStatus.Finalized }),
    });
    await expect(
      useCase.execute(ACTOR, 'team-1', 'match-1', {
        transition: MatchTransition.Start,
        expectedRecordVersion: 2,
        reason: null,
      }),
    ).rejects.toBeInstanceOf(MatchFinalizedError);
    expect(applyStatusChange).not.toHaveBeenCalled();
  });

  it('refuses a transition that is not on the table', async () => {
    const { useCase, applyStatusChange } = build({
      existing: match({ status: MatchStatus.Scheduled }),
    });
    await expect(
      useCase.execute(ACTOR, 'team-1', 'match-1', {
        transition: MatchTransition.Start,
        expectedRecordVersion: 2,
        reason: null,
      }),
    ).rejects.toBeInstanceOf(MatchInvalidTransitionError);
    expect(applyStatusChange).not.toHaveBeenCalled();
  });

  it('requires an explicit reason to abandon a match', async () => {
    const { useCase, applyStatusChange } = build({});
    await expect(
      useCase.execute(ACTOR, 'team-1', 'match-1', {
        transition: MatchTransition.Abandon,
        expectedRecordVersion: 2,
        reason: null,
      }),
    ).rejects.toBeInstanceOf(MatchValidationError);
    expect(applyStatusChange).not.toHaveBeenCalled();
  });

  it('records the abandon reason when one is supplied', async () => {
    const { useCase, applyStatusChange } = build({
      changed: match({
        status: MatchStatus.Abandoned,
        abandonReason: 'lightning',
      }),
    });
    await useCase.execute(ACTOR, 'team-1', 'match-1', {
      transition: MatchTransition.Abandon,
      expectedRecordVersion: 2,
      reason: 'lightning',
    });
    expect(applyStatusChange.mock.calls[0]?.[1]).toMatchObject({
      toStatus: MatchStatus.Abandoned,
      abandonReason: 'lightning',
      abandonedAt: NOW,
    });
  });

  it('raises a version conflict and publishes nothing', async () => {
    const { useCase, events, audit } = build({ changed: null });
    await expect(
      useCase.execute(ACTOR, 'team-1', 'match-1', {
        transition: MatchTransition.Start,
        expectedRecordVersion: 99,
        reason: null,
      }),
    ).rejects.toBeInstanceOf(MatchVersionConflictError);
    expect(events.enqueue).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('audits every accepted transition', async () => {
    const { useCase, audit } = build({});
    await useCase.execute(ACTOR, 'team-1', 'match-1', {
      transition: MatchTransition.Start,
      expectedRecordVersion: 2,
      reason: null,
    });
    expect(audit.record.mock.calls[0]?.[1]).toMatchObject({
      action: 'match.transitioned',
      resourceId: 'match-1',
    });
  });
});
