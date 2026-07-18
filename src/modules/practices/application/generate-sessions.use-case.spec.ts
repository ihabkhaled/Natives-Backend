import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  RecurrenceFrequency,
  ScheduleStatus,
  SessionStatus,
  SessionVisibility,
} from '../model/practices.enums';
import type {
  PracticeSchedule,
  PracticeSession,
} from '../model/practices.types';
import { GenerateSessionsUseCase } from './generate-sessions.use-case';

const NOW = new Date('2026-06-01T12:00:00.000Z');
const ACTOR = { userId: 'admin-1', email: 'a@example.test', roles: [] };
const SCOPE = {} as never;

const SCHEDULE: PracticeSchedule = {
  id: 'sch-1',
  teamId: 'team-1',
  seasonId: null,
  name: 'Weekly practice',
  sessionType: 'practice',
  timezone: 'Africa/Cairo',
  frequency: RecurrenceFrequency.Weekly,
  intervalWeeks: 1,
  weekdays: [1],
  startTimeLocal: '18:00',
  durationMinutes: 90,
  meetOffsetMinutes: null,
  rsvpCutoffMinutes: null,
  defaultVenueId: null,
  defaultField: null,
  defaultCapacity: null,
  visibility: SessionVisibility.Team,
  organizerUserId: null,
  notes: null,
  generationStart: '2026-01-05',
  generationUntil: '2026-01-19',
  exceptions: [],
  status: ScheduleStatus.Active,
  createdBy: 'admin-1',
  updatedBy: null,
  createdAt: NOW,
  updatedAt: NOW,
  version: 1,
};

const SESSION: PracticeSession = {
  id: 'ses-1',
  teamId: 'team-1',
  seasonId: null,
  scheduleId: 'sch-1',
  occurrenceDate: '2026-01-12',
  sessionType: 'practice',
  timezone: 'Africa/Cairo',
  venueId: null,
  field: null,
  capacity: null,
  meetAt: null,
  startsAt: new Date('2026-01-12T16:00:00.000Z'),
  endsAt: new Date('2026-01-12T17:30:00.000Z'),
  rsvpCutoffAt: null,
  visibility: SessionVisibility.Team,
  organizerUserId: null,
  notes: null,
  status: SessionStatus.Published,
  cancellationReason: null,
  createdBy: 'admin-1',
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
  const lookup = { requireSchedule: vi.fn().mockResolvedValue(SCHEDULE) };
  const sessions = {
    listOccurrenceDates: vi.fn().mockResolvedValue(['2026-01-05']),
    insertGenerated: vi.fn().mockResolvedValue(SESSION),
  };
  const audit = { record: vi.fn() };
  const useCase = new GenerateSessionsUseCase(
    unitOfWork as never,
    clock,
    idGenerator,
    lookup as never,
    sessions as never,
    audit as never,
  );
  return { useCase, lookup, sessions, audit };
}

describe('GenerateSessionsUseCase', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('inserts only missing occurrences and never rewrites existing ones', async () => {
    const result = await harness.useCase.execute(ACTOR, 'team-1', 'sch-1');

    // target = 01-05, 01-12, 01-19; existing = 01-05 => 2 created, 1 skipped
    expect(result.created).toBe(2);
    expect(result.skipped).toBe(1);
    expect(harness.sessions.insertGenerated).toHaveBeenCalledTimes(2);
    const insertedDates = harness.sessions.insertGenerated.mock.calls.map(
      call => (call[1] as { occurrenceDate: string }).occurrenceDate,
    );
    expect(insertedDates).toEqual(['2026-01-12', '2026-01-19']);
    expect(harness.audit.record).toHaveBeenCalledOnce();
  });

  it('generates nothing for an archived schedule', async () => {
    harness.lookup.requireSchedule.mockResolvedValue({
      ...SCHEDULE,
      status: ScheduleStatus.Archived,
    });
    const result = await harness.useCase.execute(ACTOR, 'team-1', 'sch-1');
    expect(result).toEqual({ created: 0, skipped: 0, sessions: [] });
    expect(harness.sessions.listOccurrenceDates).not.toHaveBeenCalled();
    expect(harness.sessions.insertGenerated).not.toHaveBeenCalled();
  });

  it('counts a concurrent conflict (null insert) as skipped', async () => {
    harness.sessions.listOccurrenceDates.mockResolvedValue([]);
    harness.sessions.insertGenerated
      .mockResolvedValueOnce(SESSION)
      .mockResolvedValueOnce(SESSION)
      .mockResolvedValueOnce(null);
    const result = await harness.useCase.execute(ACTOR, 'team-1', 'sch-1');
    expect(result.created).toBe(2);
    expect(result.skipped).toBe(1);
  });
});
