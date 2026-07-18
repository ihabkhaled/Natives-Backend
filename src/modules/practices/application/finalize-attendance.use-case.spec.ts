import { describe, expect, it, vi } from 'vitest';

import { InvalidAttendanceTransitionError } from '../errors/invalid-attendance-transition.error';
import { OptimisticConflictError } from '../errors/optimistic-conflict.error';
import { ATTENDANCE_FINALIZED_EVENT } from '../model/attendance.constants';
import { AttendanceState } from '../model/attendance.enums';
import type { AttendanceSheet } from '../model/attendance.types';
import { SessionStatus, SessionVisibility } from '../model/practices.enums';
import type { PracticeSession } from '../model/practices.types';
import { FinalizeAttendanceUseCase } from './finalize-attendance.use-case';

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
    status: SessionStatus.Completed,
    cancellationReason: null,
    createdBy: null,
    updatedBy: null,
    createdAt: NOW,
    updatedAt: NOW,
    version: 1,
  };
}

function sheet(state: AttendanceState, version: number): AttendanceSheet {
  return {
    id: 'sheet-1',
    sessionId: 'ses-1',
    teamId: 'team-1',
    seasonId: 'season-1',
    state,
    finalizedAt: state === AttendanceState.Open ? null : NOW,
    finalizedBy: state === AttendanceState.Open ? null : 'coach-1',
    createdBy: 'coach-1',
    updatedBy: null,
    createdAt: NOW,
    updatedAt: NOW,
    version,
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
    finalize: vi.fn().mockResolvedValue(sheet(AttendanceState.Finalized, 2)),
  };
  const records = { countBySession: vi.fn().mockResolvedValue(3) };
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  const events = { enqueue: vi.fn().mockResolvedValue(undefined) };
  const useCase = new FinalizeAttendanceUseCase(
    unitOfWork as never,
    clock,
    lookup as never,
    sheetService as never,
    sheets as never,
    records as never,
    audit as never,
    events as never,
  );
  return { useCase, sheets, audit, events };
}

describe('FinalizeAttendanceUseCase', () => {
  it('finalizes an open sheet and emits the finalized event', async () => {
    const harness = build(sheet(AttendanceState.Open, 1));
    const result = await harness.useCase.execute(ACTOR, 'team-1', 'ses-1', {
      expectedVersion: 1,
    });
    expect(result.state).toBe(AttendanceState.Finalized);
    expect(result.recordCount).toBe(3);
    expect(harness.audit.record).toHaveBeenCalledOnce();
    expect(harness.events.enqueue.mock.calls[0]?.[1]).toMatchObject({
      eventType: ATTENDANCE_FINALIZED_EVENT,
    });
  });

  it('rejects finalizing an already-finalized sheet', async () => {
    const harness = build(sheet(AttendanceState.Finalized, 2));
    await expect(
      harness.useCase.execute(ACTOR, 'team-1', 'ses-1', { expectedVersion: 2 }),
    ).rejects.toBeInstanceOf(InvalidAttendanceTransitionError);
    expect(harness.sheets.finalize).not.toHaveBeenCalled();
  });

  it('maps a lost finalize race to a version conflict', async () => {
    const harness = build(sheet(AttendanceState.Open, 1));
    harness.sheets.finalize.mockResolvedValue(null);
    await expect(
      harness.useCase.execute(ACTOR, 'team-1', 'ses-1', { expectedVersion: 1 }),
    ).rejects.toBeInstanceOf(OptimisticConflictError);
  });
});
