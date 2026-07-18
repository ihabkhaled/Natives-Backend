import { beforeEach, describe, expect, it, vi } from 'vitest';

import { OptimisticConflictError } from '../errors/optimistic-conflict.error';
import { SessionStatus, SessionVisibility } from '../model/practices.enums';
import type {
  PracticeSession,
  UpdateSessionCommand,
} from '../model/practices.types';
import { UpdatePracticeSessionUseCase } from './update-practice-session.use-case';

const NOW = new Date('2026-06-01T12:00:00.000Z');
const ACTOR = { userId: 'coach-1', email: 'c@example.test', roles: [] };
const SCOPE = {} as never;

const SESSION: PracticeSession = {
  id: 'ses-1',
  teamId: 'team-1',
  seasonId: null,
  scheduleId: null,
  occurrenceDate: null,
  sessionType: 'practice',
  timezone: 'Africa/Cairo',
  venueId: null,
  field: null,
  capacity: null,
  meetAt: null,
  startsAt: new Date('2026-07-15T15:00:00.000Z'),
  endsAt: new Date('2026-07-15T17:00:00.000Z'),
  rsvpCutoffAt: null,
  visibility: SessionVisibility.Team,
  organizerUserId: null,
  notes: null,
  status: SessionStatus.Published,
  cancellationReason: null,
  createdBy: 'coach-1',
  updatedBy: null,
  createdAt: NOW,
  updatedAt: NOW,
  version: 1,
};

const COMMAND: UpdateSessionCommand = {
  venueId: 'venue-2',
  field: 'Field B',
  capacity: 30,
  notes: 'Bring bibs',
  visibility: SessionVisibility.Coaches,
  expectedVersion: 1,
};

function build() {
  const unitOfWork = {
    runInTransaction: vi.fn((op: (scope: never) => unknown) => op(SCOPE)),
  };
  const clock = { now: () => NOW, uptime: () => 0 };
  const lookup = { requireSession: vi.fn().mockResolvedValue(SESSION) };
  const scopeValidation = {
    validateReferences: vi.fn().mockResolvedValue(undefined),
  };
  const sessions = {
    updateDetails: vi.fn().mockResolvedValue({
      ...SESSION,
      venueId: 'venue-2',
      field: 'Field B',
      version: 2,
    }),
  };
  const audit = { record: vi.fn() };
  const events = { enqueue: vi.fn().mockResolvedValue({ eventId: 'event-1' }) };
  const useCase = new UpdatePracticeSessionUseCase(
    unitOfWork as never,
    clock,
    lookup as never,
    scopeValidation as never,
    sessions as never,
    audit as never,
    events as never,
  );
  return { useCase, scopeValidation, sessions, audit, events, lookup };
}

describe('UpdatePracticeSessionUseCase', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('updates details, validating a changed venue, and audits', async () => {
    const result = await harness.useCase.execute(
      ACTOR,
      'team-1',
      'ses-1',
      COMMAND,
    );
    expect(result.version).toBe(2);
    expect(harness.scopeValidation.validateReferences).toHaveBeenCalledWith(
      SCOPE,
      'team-1',
      null,
      'venue-2',
    );
    expect(harness.audit.record).toHaveBeenCalledOnce();
    expect(harness.events.enqueue.mock.calls[0]?.[1]).toMatchObject({
      eventType: 'practice.venue_changed',
      aggregateId: 'ses-1',
      payload: { venueId: 'venue-2', field: 'Field B' },
    });
  });

  it('does not notify for a draft venue edit', async () => {
    harness.lookup.requireSession.mockResolvedValue({
      ...SESSION,
      status: SessionStatus.Draft,
    });
    harness.sessions.updateDetails.mockResolvedValue({
      ...SESSION,
      status: SessionStatus.Draft,
      venueId: 'venue-2',
      version: 2,
    });
    await harness.useCase.execute(ACTOR, 'team-1', 'ses-1', COMMAND);
    expect(harness.events.enqueue).not.toHaveBeenCalled();
  });

  it('rejects a stale expected version before writing', async () => {
    await expect(
      harness.useCase.execute(ACTOR, 'team-1', 'ses-1', {
        ...COMMAND,
        expectedVersion: 99,
      }),
    ).rejects.toBeInstanceOf(OptimisticConflictError);
    expect(harness.sessions.updateDetails).not.toHaveBeenCalled();
  });

  it('maps a lost concurrent update to a version conflict', async () => {
    harness.sessions.updateDetails.mockResolvedValue(null);
    await expect(
      harness.useCase.execute(ACTOR, 'team-1', 'ses-1', COMMAND),
    ).rejects.toBeInstanceOf(OptimisticConflictError);
  });
});
