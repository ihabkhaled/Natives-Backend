import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AttendanceMembershipNotFoundError } from '../errors/attendance-membership-not-found.error';
import { InvalidAttendanceInputError } from '../errors/invalid-attendance-input.error';
import { InvalidAttendanceTransitionError } from '../errors/invalid-attendance-transition.error';
import { ATTENDANCE_CORRECTED_EVENT } from '../model/attendance.constants';
import {
  AttendanceSource,
  AttendanceState,
  AttendanceStatus,
} from '../model/attendance.enums';
import type {
  AttendanceRecord,
  AttendanceSheet,
  CorrectAttendanceCommand,
} from '../model/attendance.types';
import { SessionStatus, SessionVisibility } from '../model/practices.enums';
import type { PracticeSession } from '../model/practices.types';
import { CorrectAttendanceUseCase } from './correct-attendance.use-case';

const NOW = new Date('2026-06-01T12:00:00.000Z');
const SCOPE = {} as never;
const ACTOR = { userId: 'admin-1', email: 'a@example.test', roles: [] };

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
    status: SessionStatus.Completed,
    cancellationReason: null,
    createdBy: null,
    updatedBy: null,
    createdAt: NOW,
    updatedAt: NOW,
    version: 1,
  };
}

function sheet(state: AttendanceState): AttendanceSheet {
  return {
    id: 'sheet-1',
    sessionId: 'ses-1',
    teamId: 'team-1',
    seasonId: 'season-1',
    state,
    finalizedAt: NOW,
    finalizedBy: 'coach-1',
    createdBy: 'coach-1',
    updatedBy: null,
    createdAt: NOW,
    updatedAt: NOW,
    version: 2,
  };
}

const RECORD: AttendanceRecord = {
  id: 'rec-1',
  sheetId: 'sheet-1',
  sessionId: 'ses-1',
  teamId: 'team-1',
  seasonId: 'season-1',
  membershipId: 'mem-1',
  userId: 'user-1',
  status: AttendanceStatus.Excused,
  checkInAt: null,
  checkOutAt: null,
  latenessMinutes: null,
  excuseCategory: null,
  note: null,
  evidenceRef: null,
  source: AttendanceSource.Coach,
  recordedBy: 'admin-1',
  recordedAt: NOW,
  createdBy: 'coach-1',
  updatedBy: 'admin-1',
  createdAt: NOW,
  updatedAt: NOW,
  version: 2,
};

function command(
  overrides: Partial<CorrectAttendanceCommand> = {},
): CorrectAttendanceCommand {
  return {
    status: AttendanceStatus.Excused,
    checkInAt: null,
    checkOutAt: null,
    latenessMinutes: null,
    excuseCategory: null,
    note: null,
    evidenceRef: null,
    correctionReason: 'doctor note',
    expectedVersion: 2,
    ...overrides,
  };
}

function build(existing: AttendanceSheet) {
  const unitOfWork = {
    runInTransaction: vi.fn((op: (scope: never) => unknown) => op(SCOPE)),
  };
  const clock = { now: () => NOW, uptime: () => 0 };
  const lookup = { requireSession: vi.fn().mockResolvedValue(session()) };
  const sheetService = { requireSheet: vi.fn().mockResolvedValue(existing) };
  const sheets = {
    applyCorrection: vi
      .fn()
      .mockResolvedValue(sheet(AttendanceState.Corrected)),
  };
  const memberships = {
    findByIdInTeam: vi
      .fn()
      .mockResolvedValue({ id: 'mem-1', userId: 'user-1' }),
  };
  const recorder = { record: vi.fn().mockResolvedValue(RECORD) };
  const events = { enqueue: vi.fn().mockResolvedValue(undefined) };
  const useCase = new CorrectAttendanceUseCase(
    unitOfWork as never,
    clock,
    lookup as never,
    sheetService as never,
    sheets as never,
    memberships as never,
    recorder as never,
    events as never,
  );
  return { useCase, sheets, memberships, recorder, events };
}

describe('CorrectAttendanceUseCase', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build(sheet(AttendanceState.Finalized));
  });

  it('corrects a finalized record and emits the corrected event', async () => {
    const view = await harness.useCase.execute(
      ACTOR,
      'team-1',
      'ses-1',
      'mem-1',
      command(),
    );
    expect(view.status).toBe(AttendanceStatus.Excused);
    expect(harness.sheets.applyCorrection).toHaveBeenCalledOnce();
    expect(harness.events.enqueue.mock.calls[0]?.[1]).toMatchObject({
      eventType: ATTENDANCE_CORRECTED_EVENT,
    });
  });

  it('rejects correcting a sheet that is still open', async () => {
    const open = build(sheet(AttendanceState.Open));
    await expect(
      open.useCase.execute(ACTOR, 'team-1', 'ses-1', 'mem-1', command()),
    ).rejects.toBeInstanceOf(InvalidAttendanceTransitionError);
    expect(open.recorder.record).not.toHaveBeenCalled();
  });

  it('rejects a correction inconsistent with its status', async () => {
    await expect(
      harness.useCase.execute(
        ACTOR,
        'team-1',
        'ses-1',
        'mem-1',
        command({ status: AttendanceStatus.Absent, latenessMinutes: 5 }),
      ),
    ).rejects.toBeInstanceOf(InvalidAttendanceInputError);
  });

  it('rejects a membership outside the team scope', async () => {
    harness.memberships.findByIdInTeam.mockResolvedValue(null);
    await expect(
      harness.useCase.execute(ACTOR, 'team-1', 'ses-1', 'mem-x', command()),
    ).rejects.toBeInstanceOf(AttendanceMembershipNotFoundError);
  });

  it('maps a lost correction race to an invalid transition', async () => {
    harness.sheets.applyCorrection.mockResolvedValue(null);
    await expect(
      harness.useCase.execute(ACTOR, 'team-1', 'ses-1', 'mem-1', command()),
    ).rejects.toBeInstanceOf(InvalidAttendanceTransitionError);
  });
});
