import { beforeEach, describe, expect, it, vi } from 'vitest';

import { OptimisticConflictError } from '../errors/optimistic-conflict.error';
import { AttendanceSource, AttendanceStatus } from '../model/attendance.enums';
import type {
  AttendanceRecord,
  AttendanceWriteContext,
} from '../model/attendance.types';
import { SessionStatus, SessionVisibility } from '../model/practices.enums';
import type { PracticeSession } from '../model/practices.types';
import { AttendanceRecorderService } from './attendance-recorder.service';

const NOW = new Date('2026-06-01T12:00:00.000Z');
const SCOPE = {} as never;

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

function record(overrides: Partial<AttendanceRecord> = {}): AttendanceRecord {
  return {
    id: 'rec-1',
    sheetId: 'sheet-1',
    sessionId: 'ses-1',
    teamId: 'team-1',
    seasonId: 'season-1',
    membershipId: 'mem-1',
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
    ...overrides,
  };
}

function context(
  overrides: Partial<AttendanceWriteContext> = {},
): AttendanceWriteContext {
  return {
    sheetId: 'sheet-1',
    session: session(),
    membershipId: 'mem-1',
    userId: 'user-1',
    status: AttendanceStatus.PresentOnTime,
    checkInAt: null,
    checkOutAt: null,
    latenessMinutes: null,
    excuseCategory: null,
    note: null,
    evidenceRef: null,
    source: AttendanceSource.Coach,
    isCorrection: false,
    correctionReason: null,
    expectedVersion: null,
    actorUserId: 'coach-1',
    now: NOW,
    ...overrides,
  };
}

function build() {
  const records = {
    findBySessionMembership: vi.fn().mockResolvedValue(null),
    insert: vi.fn(),
    update: vi.fn(),
  };
  const revisions = { append: vi.fn().mockResolvedValue(undefined) };
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  const idGenerator = { generate: vi.fn().mockReturnValue('gen') };
  const service = new AttendanceRecorderService(
    idGenerator,
    records as never,
    revisions as never,
    audit as never,
  );
  return { service, records, revisions, audit };
}

describe('AttendanceRecorderService', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('inserts a first record and appends a revision + audit', async () => {
    harness.records.insert.mockResolvedValue(record());
    const result = await harness.service.record(SCOPE, context());
    expect(result.id).toBe('rec-1');
    expect(harness.revisions.append).toHaveBeenCalledOnce();
    expect(harness.audit.record).toHaveBeenCalledOnce();
  });

  it('maps a concurrent duplicate insert to a version conflict', async () => {
    harness.records.insert.mockResolvedValue(null);
    await expect(
      harness.service.record(SCOPE, context()),
    ).rejects.toBeInstanceOf(OptimisticConflictError);
  });

  it('updates an existing record when the expected version matches', async () => {
    harness.records.findBySessionMembership.mockResolvedValue(
      record({ version: 2 }),
    );
    harness.records.update.mockResolvedValue(record({ version: 3 }));
    const result = await harness.service.record(
      SCOPE,
      context({ expectedVersion: 2 }),
    );
    expect(result.version).toBe(3);
    expect(harness.records.update).toHaveBeenCalledOnce();
  });

  it('rejects a stale expected version before writing', async () => {
    harness.records.findBySessionMembership.mockResolvedValue(
      record({ version: 5 }),
    );
    await expect(
      harness.service.record(SCOPE, context({ expectedVersion: 2 })),
    ).rejects.toBeInstanceOf(OptimisticConflictError);
    expect(harness.records.update).not.toHaveBeenCalled();
  });

  it('maps a lost update race to a version conflict', async () => {
    harness.records.findBySessionMembership.mockResolvedValue(record());
    harness.records.update.mockResolvedValue(null);
    await expect(
      harness.service.record(SCOPE, context()),
    ).rejects.toBeInstanceOf(OptimisticConflictError);
  });
});
