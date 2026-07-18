import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  RecurrenceFrequency,
  ScheduleStatus,
  SessionVisibility,
} from '../model/practices.enums';
import type { PracticeSchedule } from '../model/practices.types';
import { ArchivePracticeScheduleUseCase } from './archive-practice-schedule.use-case';

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
  const lookup = { requireSchedule: vi.fn().mockResolvedValue(SCHEDULE) };
  const schedules = {
    archive: vi
      .fn()
      .mockResolvedValue({ ...SCHEDULE, status: ScheduleStatus.Archived }),
  };
  const audit = { record: vi.fn() };
  const useCase = new ArchivePracticeScheduleUseCase(
    unitOfWork as never,
    clock,
    lookup as never,
    schedules as never,
    audit as never,
  );
  return { useCase, schedules, audit };
}

describe('ArchivePracticeScheduleUseCase', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('archives an active schedule and audits', async () => {
    const result = await harness.useCase.execute(ACTOR, 'team-1', 'sch-1');
    expect(result.status).toBe(ScheduleStatus.Archived);
    expect(harness.audit.record).toHaveBeenCalledOnce();
  });

  it('is idempotent: returns the existing record when already archived', async () => {
    harness.schedules.archive.mockResolvedValue(null);
    const result = await harness.useCase.execute(ACTOR, 'team-1', 'sch-1');
    expect(result).toBe(SCHEDULE);
    expect(harness.audit.record).toHaveBeenCalledOnce();
  });
});
