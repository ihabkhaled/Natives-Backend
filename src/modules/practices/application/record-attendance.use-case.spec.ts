import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AttendanceMembershipNotFoundError } from '../errors/attendance-membership-not-found.error';
import { InvalidAttendanceInputError } from '../errors/invalid-attendance-input.error';
import {
  AttendanceSource,
  AttendanceState,
  AttendanceStatus,
} from '../model/attendance.enums';
import type {
  AttendanceMarkFields,
  AttendanceRecord,
  AttendanceSheet,
} from '../model/attendance.types';
import { SessionStatus, SessionVisibility } from '../model/practices.enums';
import type { PracticeSession } from '../model/practices.types';
import { RecordAttendanceUseCase } from './record-attendance.use-case';

const NOW = new Date('2026-06-01T12:00:00.000Z');
const SCOPE = {} as never;
const ACTOR = { userId: 'coach-1', email: 'c@example.test', roles: [] };

function session(): PracticeSession {
  return {
    id: 'ses-1',
    teamId: 'team-1',
    seasonId: 'season-1',
    scheduleId: null,
    occurrenceDate: null,
    sessionType: 'practice',
    timezone: 'Africa/Cairo',
    venueId: null,
    field: null,
    capacity: null,
    meetAt: null,
    startsAt: NOW,
    endsAt: NOW,
    rsvpCutoffAt: null,
    visibility: SessionVisibility.Team,
    organizerUserId: null,
    notes: null,
    status: SessionStatus.Published,
    cancellationReason: null,
    createdBy: null,
    updatedBy: null,
    createdAt: NOW,
    updatedAt: NOW,
    version: 1,
  };
}

const SHEET: AttendanceSheet = {
  id: 'sheet-1',
  sessionId: 'ses-1',
  teamId: 'team-1',
  seasonId: 'season-1',
  state: AttendanceState.Open,
  finalizedAt: null,
  finalizedBy: null,
  createdBy: null,
  updatedBy: null,
  createdAt: NOW,
  updatedAt: NOW,
  version: 1,
};

function record(membershipId: string): AttendanceRecord {
  return {
    id: `rec-${membershipId}`,
    sheetId: 'sheet-1',
    sessionId: 'ses-1',
    teamId: 'team-1',
    seasonId: 'season-1',
    membershipId,
    userId: 'user-1',
    status: AttendanceStatus.PresentOnTime,
    checkInAt: null,
    checkOutAt: null,
    latenessMinutes: null,
    excuseCategory: null,
    note: null,
    evidenceRef: null,
    source: AttendanceSource.Coach,
    recordedBy: 'coach-1',
    recordedAt: NOW,
    createdBy: 'coach-1',
    updatedBy: null,
    createdAt: NOW,
    updatedAt: NOW,
    version: 1,
  };
}

function mark(
  overrides: Partial<AttendanceMarkFields> = {},
): AttendanceMarkFields {
  return {
    status: AttendanceStatus.PresentOnTime,
    checkInAt: null,
    checkOutAt: null,
    latenessMinutes: null,
    excuseCategory: null,
    note: null,
    evidenceRef: null,
    expectedVersion: null,
    ...overrides,
  };
}

function build() {
  const unitOfWork = {
    runInTransaction: vi.fn((op: (scope: never) => unknown) => op(SCOPE)),
  };
  const clock = { now: () => NOW, uptime: () => 0 };
  const lookup = { requireSession: vi.fn().mockResolvedValue(session()) };
  const sheetService = {
    ensureOpenSheet: vi.fn().mockResolvedValue(SHEET),
    requireSheet: vi.fn(),
  };
  const memberships = {
    findActiveById: vi
      .fn()
      .mockImplementation((_s: never, _t: string, id: string) =>
        Promise.resolve({ id, userId: 'user-1' }),
      ),
  };
  const recorder = {
    record: vi
      .fn()
      .mockImplementation((_s: never, ctx: { membershipId: string }) =>
        Promise.resolve(record(ctx.membershipId)),
      ),
  };
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  const useCase = new RecordAttendanceUseCase(
    unitOfWork as never,
    clock,
    lookup as never,
    sheetService as never,
    memberships as never,
    recorder as never,
    audit as never,
  );
  return { useCase, recorder, memberships, audit };
}

describe('RecordAttendanceUseCase.recordOne', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('records one mark and returns the view', async () => {
    const view = await harness.useCase.recordOne(
      ACTOR,
      'team-1',
      'ses-1',
      'mem-1',
      mark(),
    );
    expect(view.membershipId).toBe('mem-1');
    expect(harness.recorder.record).toHaveBeenCalledOnce();
  });

  it('rejects a mark inconsistent with its status', async () => {
    await expect(
      harness.useCase.recordOne(
        ACTOR,
        'team-1',
        'ses-1',
        'mem-1',
        mark({ latenessMinutes: 5 }),
      ),
    ).rejects.toBeInstanceOf(InvalidAttendanceInputError);
    expect(harness.recorder.record).not.toHaveBeenCalled();
  });

  it('rejects a membership outside the team scope', async () => {
    harness.memberships.findActiveById.mockResolvedValue(null);
    await expect(
      harness.useCase.recordOne(ACTOR, 'team-1', 'ses-1', 'mem-x', mark()),
    ).rejects.toBeInstanceOf(AttendanceMembershipNotFoundError);
  });
});

describe('RecordAttendanceUseCase.recordBulk', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('applies every mark atomically and writes a bulk audit', async () => {
    const result = await harness.useCase.recordBulk(ACTOR, 'team-1', 'ses-1', {
      marks: [
        { ...mark(), membershipId: 'mem-1' },
        { ...mark({ status: AttendanceStatus.Absent }), membershipId: 'mem-2' },
      ],
    });
    expect(result.recorded).toBe(2);
    expect(harness.recorder.record).toHaveBeenCalledTimes(2);
    expect(harness.audit.record).toHaveBeenCalledOnce();
  });

  it('rejects a batch with a duplicate membership before writing', async () => {
    await expect(
      harness.useCase.recordBulk(ACTOR, 'team-1', 'ses-1', {
        marks: [
          { ...mark(), membershipId: 'mem-1' },
          { ...mark(), membershipId: 'mem-1' },
        ],
      }),
    ).rejects.toBeInstanceOf(InvalidAttendanceInputError);
    expect(harness.recorder.record).not.toHaveBeenCalled();
  });
});
