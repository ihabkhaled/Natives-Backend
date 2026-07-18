import { beforeEach, describe, expect, it, vi } from 'vitest';

import { InvalidScheduleError } from '../errors/invalid-schedule.error';
import { OptimisticConflictError } from '../errors/optimistic-conflict.error';
import {
  RecurrenceFrequency,
  ScheduleStatus,
  SessionVisibility,
} from '../model/practices.enums';
import type {
  PracticeSchedule,
  UpdateScheduleCommand,
} from '../model/practices.types';
import { UpdatePracticeScheduleUseCase } from './update-practice-schedule.use-case';

const NOW = new Date('2026-06-01T12:00:00.000Z');
const ACTOR = { userId: 'admin-1', email: 'a@example.test', roles: [] };
const SCOPE = {} as never;

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
  meetOffsetMinutes: null,
  rsvpCutoffMinutes: null,
  defaultVenueId: null,
  defaultField: null,
  defaultCapacity: null,
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

const COMMAND: UpdateScheduleCommand = {
  seasonId: 'season-1',
  name: 'Renamed',
  sessionType: 'practice',
  timezone: null,
  frequency: RecurrenceFrequency.Weekly,
  intervalWeeks: null,
  weekdays: [2],
  startTimeLocal: '19:00',
  durationMinutes: 120,
  meetOffsetMinutes: null,
  rsvpCutoffMinutes: null,
  defaultVenueId: null,
  defaultField: null,
  defaultCapacity: null,
  visibility: null,
  organizerUserId: null,
  notes: null,
  generationStart: '2026-01-05',
  generationUntil: '2026-02-28',
  exceptions: [],
  status: ScheduleStatus.Active,
  expectedVersion: 1,
};

function build() {
  const unitOfWork = {
    runInTransaction: vi.fn((op: (scope: never) => unknown) => op(SCOPE)),
  };
  const clock = { now: () => NOW, uptime: () => 0 };
  const lookup = {
    requireSchedule: vi.fn().mockResolvedValue(SCHEDULE),
  };
  const scopeValidation = {
    validateReferences: vi.fn().mockResolvedValue(undefined),
  };
  const schedules = {
    update: vi.fn().mockResolvedValue({ ...SCHEDULE, version: 2 }),
  };
  const audit = { record: vi.fn() };
  const useCase = new UpdatePracticeScheduleUseCase(
    unitOfWork as never,
    clock,
    lookup as never,
    scopeValidation as never,
    schedules as never,
    audit as never,
  );
  return { useCase, lookup, scopeValidation, schedules, audit };
}

describe('UpdatePracticeScheduleUseCase', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('updates the template under optimistic concurrency and audits', async () => {
    const result = await harness.useCase.execute(
      ACTOR,
      'team-1',
      'sch-1',
      COMMAND,
    );
    expect(result.version).toBe(2);
    expect(harness.scopeValidation.validateReferences).toHaveBeenCalledOnce();
    expect(harness.audit.record).toHaveBeenCalledOnce();
  });

  it('rejects a stale expected version before writing', async () => {
    await expect(
      harness.useCase.execute(ACTOR, 'team-1', 'sch-1', {
        ...COMMAND,
        expectedVersion: 99,
      }),
    ).rejects.toBeInstanceOf(OptimisticConflictError);
    expect(harness.schedules.update).not.toHaveBeenCalled();
  });

  it('rejects an invalid recurrence', async () => {
    await expect(
      harness.useCase.execute(ACTOR, 'team-1', 'sch-1', {
        ...COMMAND,
        weekdays: [],
      }),
    ).rejects.toBeInstanceOf(InvalidScheduleError);
  });

  it('maps a lost concurrent update to a version conflict', async () => {
    harness.schedules.update.mockResolvedValue(null);
    await expect(
      harness.useCase.execute(ACTOR, 'team-1', 'sch-1', COMMAND),
    ).rejects.toBeInstanceOf(OptimisticConflictError);
  });
});
