import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AttendanceNotMemberError } from '../errors/attendance-not-member.error';
import {
  AttendanceSource,
  AttendanceState,
  AttendanceStatus,
} from '../model/attendance.enums';
import type {
  AttendanceRecord,
  AttendanceSheet,
} from '../model/attendance.types';
import { SessionStatus, SessionVisibility } from '../model/practices.enums';
import type { PracticeSession } from '../model/practices.types';
import { SelfCheckInUseCase } from './self-check-in.use-case';

const NOW = new Date('2026-06-01T15:10:00.000Z');
const SCOPE = {} as never;
const ACTOR = { userId: 'user-1', email: 'm@example.test', roles: [] };

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
    startsAt: new Date('2026-06-01T15:00:00.000Z'),
    endsAt: new Date('2026-06-01T17:00:00.000Z'),
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

const RECORD: AttendanceRecord = {
  id: 'rec-1',
  sheetId: 'sheet-1',
  sessionId: 'ses-1',
  teamId: 'team-1',
  seasonId: 'season-1',
  membershipId: 'mem-1',
  userId: 'user-1',
  status: AttendanceStatus.PresentLate,
  checkInAt: NOW,
  checkOutAt: null,
  latenessMinutes: 10,
  excuseCategory: null,
  note: null,
  evidenceRef: null,
  source: AttendanceSource.Self,
  recordedBy: 'user-1',
  recordedAt: NOW,
  createdBy: 'user-1',
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
  const lookup = { requireSession: vi.fn().mockResolvedValue(session()) };
  const sheetService = { ensureOpenSheet: vi.fn().mockResolvedValue(SHEET) };
  const memberships = {
    findActiveByUser: vi
      .fn()
      .mockResolvedValue({ id: 'mem-1', userId: 'user-1' }),
  };
  const recorder = { record: vi.fn().mockResolvedValue(RECORD) };
  const useCase = new SelfCheckInUseCase(
    unitOfWork as never,
    clock,
    lookup as never,
    sheetService as never,
    memberships as never,
    recorder as never,
  );
  return { useCase, sheetService, memberships, recorder };
}

describe('SelfCheckInUseCase', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('checks a member in with a clock-derived late status', async () => {
    const view = await harness.useCase.execute(ACTOR, 'team-1', 'ses-1', {
      note: 'here',
    });
    expect(view.status).toBe(AttendanceStatus.PresentLate);
    const ctx = harness.recorder.record.mock.calls[0]?.[1] as {
      status: AttendanceStatus;
      latenessMinutes: number | null;
      source: AttendanceSource;
    };
    expect(ctx.status).toBe(AttendanceStatus.PresentLate);
    expect(ctx.latenessMinutes).toBe(10);
    expect(ctx.source).toBe(AttendanceSource.Self);
  });

  it('forbids a caller with no active membership before opening a sheet', async () => {
    harness.memberships.findActiveByUser.mockResolvedValue(null);
    await expect(
      harness.useCase.execute(ACTOR, 'team-1', 'ses-1', { note: null }),
    ).rejects.toBeInstanceOf(AttendanceNotMemberError);
    expect(harness.sheetService.ensureOpenSheet).not.toHaveBeenCalled();
  });
});
