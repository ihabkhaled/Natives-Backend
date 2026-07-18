import { describe, expect, it, vi } from 'vitest';

import { InvalidSessionTransitionError } from '../errors/invalid-session-transition.error';
import { OptimisticConflictError } from '../errors/optimistic-conflict.error';
import {
  PRACTICE_CANCELLED_EVENT,
  PRACTICE_PUBLISHED_EVENT,
} from '../model/practices.constants';
import { SessionStatus, SessionVisibility } from '../model/practices.enums';
import type { PracticeSession } from '../model/practices.types';
import { TransitionPracticeSessionUseCase } from './transition-practice-session.use-case';

const NOW = new Date('2026-06-01T12:00:00.000Z');
const ACTOR = { userId: 'coach-1', email: 'c@example.test', roles: [] };
const SCOPE = {} as never;

function session(status: SessionStatus): PracticeSession {
  return {
    id: 'ses-1',
    teamId: 'team-1',
    seasonId: 'season-1',
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
  const sessions = {
    applyStatusChange: vi.fn(
      (_scope: never, change: { status: SessionStatus }) =>
        Promise.resolve({ ...existing, status: change.status, version: 2 }),
    ),
  };
  const statusEvents = { append: vi.fn() };
  const audit = { record: vi.fn() };
  const events = { enqueue: vi.fn() };
  const useCase = new TransitionPracticeSessionUseCase(
    unitOfWork as never,
    clock,
    idGenerator,
    lookup as never,
    sessions as never,
    statusEvents as never,
    audit as never,
    events as never,
  );
  return { useCase, sessions, statusEvents, audit, events };
}

describe('TransitionPracticeSessionUseCase', () => {
  it('publishes a draft and emits a practice.published event', async () => {
    const harness = build(session(SessionStatus.Draft));
    const result = await harness.useCase.execute(
      ACTOR,
      'team-1',
      'ses-1',
      SessionStatus.Published,
      { reason: null, expectedVersion: 1 },
    );
    expect(result.status).toBe(SessionStatus.Published);
    expect(harness.statusEvents.append).toHaveBeenCalledOnce();
    expect(harness.audit.record).toHaveBeenCalledOnce();
    expect(harness.events.enqueue.mock.calls[0]?.[1]).toMatchObject({
      eventType: PRACTICE_PUBLISHED_EVENT,
    });
  });

  it('cancels with a reason, records it, and emits practice.cancelled', async () => {
    const harness = build(session(SessionStatus.Published));
    await harness.useCase.execute(
      ACTOR,
      'team-1',
      'ses-1',
      SessionStatus.Cancelled,
      {
        reason: 'weather',
        expectedVersion: 1,
      },
    );
    expect(harness.sessions.applyStatusChange.mock.calls[0]?.[1]).toMatchObject(
      {
        cancellationReason: 'weather',
      },
    );
    expect(harness.events.enqueue.mock.calls[0]?.[1]).toMatchObject({
      eventType: PRACTICE_CANCELLED_EVENT,
    });
  });

  it('completes a session without emitting a notification event', async () => {
    const harness = build(session(SessionStatus.Published));
    await harness.useCase.execute(
      ACTOR,
      'team-1',
      'ses-1',
      SessionStatus.Completed,
      { reason: null, expectedVersion: 1 },
    );
    expect(harness.audit.record).toHaveBeenCalledOnce();
    expect(harness.events.enqueue).not.toHaveBeenCalled();
  });

  it('rejects an illegal transition', async () => {
    const harness = build(session(SessionStatus.Completed));
    await expect(
      harness.useCase.execute(
        ACTOR,
        'team-1',
        'ses-1',
        SessionStatus.Published,
        {
          reason: null,
          expectedVersion: 1,
        },
      ),
    ).rejects.toBeInstanceOf(InvalidSessionTransitionError);
    expect(harness.sessions.applyStatusChange).not.toHaveBeenCalled();
  });

  it('rejects a stale expected version', async () => {
    const harness = build(session(SessionStatus.Draft));
    await expect(
      harness.useCase.execute(
        ACTOR,
        'team-1',
        'ses-1',
        SessionStatus.Published,
        {
          reason: null,
          expectedVersion: 99,
        },
      ),
    ).rejects.toBeInstanceOf(OptimisticConflictError);
  });

  it('maps a lost concurrent status change to a version conflict', async () => {
    const harness = build(session(SessionStatus.Draft));
    harness.sessions.applyStatusChange.mockResolvedValue(null);
    await expect(
      harness.useCase.execute(
        ACTOR,
        'team-1',
        'ses-1',
        SessionStatus.Published,
        {
          reason: null,
          expectedVersion: 1,
        },
      ),
    ).rejects.toBeInstanceOf(OptimisticConflictError);
  });
});
