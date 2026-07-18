import { describe, expect, it, vi } from 'vitest';

import { InvalidSessionTimesError } from '../errors/invalid-session-times.error';
import { InvalidSessionTransitionError } from '../errors/invalid-session-transition.error';
import { OptimisticConflictError } from '../errors/optimistic-conflict.error';
import { PRACTICE_RESCHEDULED_EVENT } from '../model/practices.constants';
import { SessionStatus, SessionVisibility } from '../model/practices.enums';
import type {
  PracticeSession,
  RescheduleSessionCommand,
} from '../model/practices.types';
import { ReschedulePracticeSessionUseCase } from './reschedule-practice-session.use-case';

const NOW = new Date('2026-06-01T12:00:00.000Z');
const ACTOR = { userId: 'coach-1', email: 'c@example.test', roles: [] };
const SCOPE = {} as never;

const COMMAND: RescheduleSessionCommand = {
  startsAt: '2026-07-20T15:00:00.000Z',
  endsAt: '2026-07-20T17:00:00.000Z',
  meetAt: null,
  rsvpCutoffAt: null,
  venueId: 'venue-2',
  field: 'Field B',
  reason: 'Field unavailable',
  expectedVersion: 1,
};

function session(status: SessionStatus): PracticeSession {
  return {
    id: 'ses-1',
    teamId: 'team-1',
    seasonId: null,
    scheduleId: null,
    occurrenceDate: null,
    sessionType: 'practice',
    timezone: 'Africa/Cairo',
    venueId: 'venue-1',
    field: null,
    capacity: null,
    meetAt: null,
    startsAt: new Date('2026-07-15T15:00:00.000Z'),
    endsAt: new Date('2026-07-15T17:00:00.000Z'),
    rsvpCutoffAt: null,
    visibility: SessionVisibility.Team,
    organizerUserId: null,
    notes: null,
    status,
    cancellationReason: null,
    createdBy: 'coach-1',
    updatedBy: null,
    createdAt: NOW,
    updatedAt: NOW,
    version: 1,
  };
}

function build(existing: PracticeSession) {
  const unitOfWork = {
    runInTransaction: vi.fn((op: (scope: never) => unknown) => op(SCOPE)),
  };
  const clock = { now: () => NOW, uptime: () => 0 };
  const idGenerator = { generate: vi.fn().mockReturnValue('gen') };
  const lookup = { requireSession: vi.fn().mockResolvedValue(existing) };
  const scopeValidation = {
    validateReferences: vi.fn().mockResolvedValue(undefined),
  };
  const sessions = {
    reschedule: vi.fn().mockResolvedValue({
      ...existing,
      status: SessionStatus.Rescheduled,
      version: 2,
    }),
  };
  const statusEvents = { append: vi.fn() };
  const audit = { record: vi.fn() };
  const events = { enqueue: vi.fn() };
  const useCase = new ReschedulePracticeSessionUseCase(
    unitOfWork as never,
    clock,
    idGenerator,
    lookup as never,
    scopeValidation as never,
    sessions as never,
    statusEvents as never,
    audit as never,
    events as never,
  );
  return { useCase, scopeValidation, sessions, statusEvents, audit, events };
}

describe('ReschedulePracticeSessionUseCase', () => {
  it('moves a published session and emits practice.rescheduled', async () => {
    const harness = build(session(SessionStatus.Published));
    const result = await harness.useCase.execute(
      ACTOR,
      'team-1',
      'ses-1',
      COMMAND,
    );
    expect(result.status).toBe(SessionStatus.Rescheduled);
    expect(harness.scopeValidation.validateReferences).toHaveBeenCalledWith(
      SCOPE,
      'team-1',
      null,
      'venue-2',
    );
    expect(harness.statusEvents.append).toHaveBeenCalledOnce();
    expect(harness.audit.record).toHaveBeenCalledOnce();
    expect(harness.events.enqueue.mock.calls[0]?.[1]).toMatchObject({
      eventType: PRACTICE_RESCHEDULED_EVENT,
    });
  });

  it('rejects moving a draft session', async () => {
    const harness = build(session(SessionStatus.Draft));
    await expect(
      harness.useCase.execute(ACTOR, 'team-1', 'ses-1', COMMAND),
    ).rejects.toBeInstanceOf(InvalidSessionTransitionError);
  });

  it('rejects a stale expected version before other checks', async () => {
    const harness = build(session(SessionStatus.Published));
    await expect(
      harness.useCase.execute(ACTOR, 'team-1', 'ses-1', {
        ...COMMAND,
        expectedVersion: 99,
      }),
    ).rejects.toBeInstanceOf(OptimisticConflictError);
  });

  it('rejects an end that precedes the new start', async () => {
    const harness = build(session(SessionStatus.Published));
    await expect(
      harness.useCase.execute(ACTOR, 'team-1', 'ses-1', {
        ...COMMAND,
        endsAt: '2026-07-20T14:00:00.000Z',
      }),
    ).rejects.toBeInstanceOf(InvalidSessionTimesError);
  });

  it('maps a lost concurrent reschedule to a version conflict', async () => {
    const harness = build(session(SessionStatus.Published));
    harness.sessions.reschedule.mockResolvedValue(null);
    await expect(
      harness.useCase.execute(ACTOR, 'team-1', 'ses-1', COMMAND),
    ).rejects.toBeInstanceOf(OptimisticConflictError);
  });
});
