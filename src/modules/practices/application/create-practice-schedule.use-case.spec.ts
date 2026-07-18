import { beforeEach, describe, expect, it, vi } from 'vitest';

import { InvalidScheduleError } from '../errors/invalid-schedule.error';
import {
  RecurrenceFrequency,
  ScheduleStatus,
  SessionVisibility,
} from '../model/practices.enums';
import type {
  CreateScheduleCommand,
  PracticeSchedule,
} from '../model/practices.types';
import { CreatePracticeScheduleUseCase } from './create-practice-schedule.use-case';

const NOW = new Date('2026-06-01T12:00:00.000Z');
const ACTOR = { userId: 'admin-1', email: 'a@example.test', roles: [] };
const SCOPE = {} as never;

const COMMAND: CreateScheduleCommand = {
  seasonId: 'season-1',
  name: 'Weekly practice',
  sessionType: 'practice',
  timezone: null,
  frequency: RecurrenceFrequency.Weekly,
  intervalWeeks: null,
  weekdays: [1],
  startTimeLocal: '18:00',
  durationMinutes: 90,
  meetOffsetMinutes: 30,
  rsvpCutoffMinutes: 120,
  defaultVenueId: 'venue-1',
  defaultField: 'Field A',
  defaultCapacity: 24,
  visibility: null,
  organizerUserId: null,
  notes: null,
  generationStart: '2026-01-05',
  generationUntil: '2026-02-28',
  exceptions: [],
};

const SCHEDULE: PracticeSchedule = {
  id: 'sch-1',
  teamId: 'team-1',
  seasonId: 'season-1',
  name: 'Weekly practice',
  sessionType: 'practice',
  timezone: 'Africa/Cairo',
  frequency: RecurrenceFrequency.Weekly,
  intervalWeeks: 1,
  weekdays: [1],
  startTimeLocal: '18:00',
  durationMinutes: 90,
  meetOffsetMinutes: 30,
  rsvpCutoffMinutes: 120,
  defaultVenueId: 'venue-1',
  defaultField: 'Field A',
  defaultCapacity: 24,
  visibility: SessionVisibility.Team,
  organizerUserId: null,
  notes: null,
  generationStart: '2026-01-05',
  generationUntil: '2026-02-28',
  exceptions: [],
  status: ScheduleStatus.Active,
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
  const scopeValidation = { validate: vi.fn().mockResolvedValue(undefined) };
  const schedules = { insert: vi.fn().mockResolvedValue(SCHEDULE) };
  const audit = { record: vi.fn() };
  const useCase = new CreatePracticeScheduleUseCase(
    unitOfWork as never,
    clock,
    idGenerator,
    scopeValidation as never,
    schedules as never,
    audit as never,
  );
  return { useCase, scopeValidation, schedules, audit };
}

describe('CreatePracticeScheduleUseCase', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('validates scope, defaults the timezone/interval, inserts, and audits', async () => {
    const result = await harness.useCase.execute(ACTOR, 'team-1', COMMAND);

    expect(result).toBe(SCHEDULE);
    expect(harness.scopeValidation.validate).toHaveBeenCalledWith(
      SCOPE,
      'team-1',
      'season-1',
      'venue-1',
    );
    expect(harness.schedules.insert.mock.calls[0]?.[1]).toMatchObject({
      timezone: 'Africa/Cairo',
      intervalWeeks: 1,
      visibility: SessionVisibility.Team,
    });
    expect(harness.audit.record).toHaveBeenCalledOnce();
  });

  it('rejects an invalid recurrence before touching scope or persistence', async () => {
    await expect(
      harness.useCase.execute(ACTOR, 'team-1', {
        ...COMMAND,
        startTimeLocal: '99:99',
      }),
    ).rejects.toBeInstanceOf(InvalidScheduleError);
    expect(harness.scopeValidation.validate).not.toHaveBeenCalled();
    expect(harness.schedules.insert).not.toHaveBeenCalled();
  });
});
