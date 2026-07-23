import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AttendanceNotMemberError } from '../errors/attendance-not-member.error';
import {
  AttendanceSource,
  AttendanceState,
  AttendanceStatus,
  SelfCheckInState,
} from '../model/attendance.enums';
import type {
  AttendanceRecord,
  AttendanceSheet,
} from '../model/attendance.types';
import { SessionStatus, SessionVisibility } from '../model/practices.enums';
import type { PracticeSession } from '../model/practices.types';
import { AttendanceQueryService } from './attendance-query.service';

const NOW = new Date('2026-06-01T15:30:00.000Z');
const SCOPE = {} as never;
const ACTOR = { userId: 'user-1', email: 'm@example.test', roles: [] };
const PAGE = { limit: 20, offset: 0 };

function session(overrides: Partial<PracticeSession> = {}): PracticeSession {
  return {
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
    ...overrides,
  };
}

function sheet(state: AttendanceState): AttendanceSheet {
  return {
    id: 'sheet-1',
    sessionId: 'ses-1',
    teamId: 'team-1',
    seasonId: null,
    state,
    finalizedAt: state === AttendanceState.Open ? null : NOW,
    finalizedBy: state === AttendanceState.Open ? null : 'coach-1',
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
  seasonId: null,
  membershipId: 'mem-1',
  userId: 'user-1',
  status: AttendanceStatus.PresentOnTime,
  checkInAt: NOW,
  checkOutAt: null,
  latenessMinutes: null,
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
  const memberships = {
    findActiveByUser: vi
      .fn()
      .mockResolvedValue({ id: 'mem-1', userId: 'user-1' }),
  };
  const sheets = {
    findBySession: vi.fn().mockResolvedValue(sheet(AttendanceState.Finalized)),
  };
  const records = {
    listRoster: vi.fn().mockResolvedValue([]),
    countRoster: vi.fn().mockResolvedValue(4),
    findBySessionMembership: vi.fn().mockResolvedValue(RECORD),
  };
  const revisions = { listBySessionMembership: vi.fn().mockResolvedValue([]) };
  const service = new AttendanceQueryService(
    unitOfWork as never,
    clock,
    lookup as never,
    memberships as never,
    sheets as never,
    records as never,
    revisions as never,
  );
  return { service, lookup, memberships, sheets, records };
}

describe('AttendanceQueryService', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('projects the roster with the sheet state and total', async () => {
    const view = await harness.service.getRoster('team-1', 'ses-1', PAGE);
    expect(view.state).toBe(AttendanceState.Finalized);
    expect(view.total).toBe(4);
  });

  it('returns a member own record when present', async () => {
    const view = await harness.service.getOwn('team-1', 'ses-1', ACTOR);
    expect(view.status).toBe(AttendanceStatus.PresentOnTime);
  });

  it('returns an explicit not-recorded view when absent', async () => {
    harness.records.findBySessionMembership.mockResolvedValue(null);
    harness.sheets.findBySession.mockResolvedValue(sheet(AttendanceState.Open));
    const view = await harness.service.getOwn('team-1', 'ses-1', ACTOR);
    expect(view.status).toBeNull();
    expect(view.version).toBeNull();
  });

  it('forbids own read for a non-member', async () => {
    harness.memberships.findActiveByUser.mockResolvedValue(null);
    await expect(
      harness.service.getOwn('team-1', 'ses-1', ACTOR),
    ).rejects.toBeInstanceOf(AttendanceNotMemberError);
  });

  it('marks selfCheckIn recorded when a record exists', async () => {
    const view = await harness.service.getOwn('team-1', 'ses-1', ACTOR);
    expect(view.selfCheckIn?.state).toBe(SelfCheckInState.Recorded);
    expect(view.selfCheckIn?.opensAt).toEqual(
      new Date('2026-06-01T14:00:00.000Z'),
    );
    expect(view.selfCheckIn?.closesAt).toEqual(
      new Date('2026-06-01T17:00:00.000Z'),
    );
  });

  it('marks selfCheckIn locked on a finalized sheet without a record', async () => {
    harness.records.findBySessionMembership.mockResolvedValue(null);
    const view = await harness.service.getOwn('team-1', 'ses-1', ACTOR);
    expect(view.selfCheckIn?.state).toBe(SelfCheckInState.Locked);
  });

  it('derives open / not_open / closed from the window on an open sheet', async () => {
    harness.records.findBySessionMembership.mockResolvedValue(null);
    harness.sheets.findBySession.mockResolvedValue(null);
    const open = await harness.service.getOwn('team-1', 'ses-1', ACTOR);
    expect(open.selfCheckIn?.state).toBe(SelfCheckInState.Open);

    harness.lookup.requireSession.mockResolvedValue(
      session({
        startsAt: new Date('2026-06-08T15:00:00.000Z'),
        endsAt: new Date('2026-06-08T17:00:00.000Z'),
      }),
    );
    const early = await harness.service.getOwn('team-1', 'ses-1', ACTOR);
    expect(early.selfCheckIn?.state).toBe(SelfCheckInState.NotOpen);

    harness.lookup.requireSession.mockResolvedValue(
      session({
        startsAt: new Date('2026-06-01T12:00:00.000Z'),
        endsAt: new Date('2026-06-01T14:00:00.000Z'),
      }),
    );
    const past = await harness.service.getOwn('team-1', 'ses-1', ACTOR);
    expect(past.selfCheckIn?.state).toBe(SelfCheckInState.Closed);
  });

  it('returns a bounded correction history', async () => {
    harness.records.findBySessionMembership.mockResolvedValue(RECORD);
    const result = await harness.service.getHistory('team-1', 'ses-1', 'mem-1');
    expect(result.items).toEqual([]);
  });
});
