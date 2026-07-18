import { beforeEach, describe, expect, it, vi } from 'vitest';

import { InvalidSessionTimesError } from '../errors/invalid-session-times.error';
import { SessionStatus, SessionVisibility } from '../model/practices.enums';
import type {
  CreateSessionCommand,
  PracticeSession,
} from '../model/practices.types';
import { CreatePracticeSessionUseCase } from './create-practice-session.use-case';

const NOW = new Date('2026-06-01T12:00:00.000Z');
const ACTOR = { userId: 'coach-1', email: 'c@example.test', roles: [] };
const SCOPE = {} as never;

const COMMAND: CreateSessionCommand = {
  seasonId: null,
  sessionType: 'scrimmage',
  timezone: null,
  venueId: 'venue-1',
  field: null,
  capacity: 20,
  startsAt: '2026-07-15T15:00:00.000Z',
  endsAt: '2026-07-15T17:00:00.000Z',
  meetAt: null,
  rsvpCutoffAt: null,
  visibility: null,
  organizerUserId: null,
  notes: null,
};

const SESSION: PracticeSession = {
  id: 'ses-1',
  teamId: 'team-1',
  seasonId: null,
  scheduleId: null,
  occurrenceDate: null,
  sessionType: 'scrimmage',
  timezone: 'Africa/Cairo',
  venueId: 'venue-1',
  field: null,
  capacity: 20,
  meetAt: null,
  startsAt: new Date(COMMAND.startsAt),
  endsAt: new Date(COMMAND.endsAt),
  rsvpCutoffAt: null,
  visibility: SessionVisibility.Team,
  organizerUserId: null,
  notes: null,
  status: SessionStatus.Draft,
  cancellationReason: null,
  createdBy: 'coach-1',
  updatedBy: null,
  createdAt: NOW,
  updatedAt: NOW,
  version: 1,
};

function build() {
  const unitOfWork = {
    runInTransaction: vi.fn((op: (scope: never) => unknown) => op(SCOPE)),
  };
  const clock = { now: () => NOW, uptime: () => 0 };
  const idGenerator = { generate: vi.fn().mockReturnValue('gen') };
  const scopeValidation = { validate: vi.fn().mockResolvedValue(undefined) };
  const sessions = { insert: vi.fn().mockResolvedValue(SESSION) };
  const statusEvents = { append: vi.fn() };
  const audit = { record: vi.fn() };
  const useCase = new CreatePracticeSessionUseCase(
    unitOfWork as never,
    clock,
    idGenerator,
    scopeValidation as never,
    sessions as never,
    statusEvents as never,
    audit as never,
  );
  return { useCase, scopeValidation, sessions, statusEvents, audit };
}

describe('CreatePracticeSessionUseCase', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('creates a draft session, records history and an audit row', async () => {
    const result = await harness.useCase.execute(ACTOR, 'team-1', COMMAND);

    expect(result).toBe(SESSION);
    expect(harness.sessions.insert.mock.calls[0]?.[1]).toMatchObject({
      status: SessionStatus.Draft,
      scheduleId: null,
    });
    expect(harness.statusEvents.append).toHaveBeenCalledOnce();
    expect(harness.audit.record).toHaveBeenCalledOnce();
  });

  it('rejects an end that precedes the start before touching scope', async () => {
    await expect(
      harness.useCase.execute(ACTOR, 'team-1', {
        ...COMMAND,
        endsAt: '2026-07-15T14:00:00.000Z',
      }),
    ).rejects.toBeInstanceOf(InvalidSessionTimesError);
    expect(harness.scopeValidation.validate).not.toHaveBeenCalled();
    expect(harness.sessions.insert).not.toHaveBeenCalled();
  });
});
