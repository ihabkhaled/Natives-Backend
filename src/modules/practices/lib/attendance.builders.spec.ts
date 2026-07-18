import { describe, expect, it } from 'vitest';

import {
  ATTENDANCE_CHECKED_IN_ACTION,
  ATTENDANCE_CORRECTED_ACTION,
  ATTENDANCE_CORRECTED_EVENT,
  ATTENDANCE_FINALIZED_EVENT,
  ATTENDANCE_RECORDED_ACTION,
} from '../model/attendance.constants';
import {
  AttendanceExcuseCategory,
  AttendanceSource,
  AttendanceState,
  AttendanceStatus,
} from '../model/attendance.enums';
import type {
  AttendanceRecord,
  AttendanceSheet,
  AttendanceWriteContext,
  CorrectAttendanceCommand,
  MembershipRef,
} from '../model/attendance.types';
import { SessionStatus, SessionVisibility } from '../model/practices.enums';
import type { PracticeSession } from '../model/practices.types';
import {
  buildAttendanceRevision,
  buildBulkAudit,
  buildCheckInContext,
  buildCorrectedEvent,
  buildCorrectionContext,
  buildFinalizeAudit,
  buildFinalizedEvent,
  buildMarkContext,
  buildNewRecord,
  buildNewSheet,
  buildRecordAudit,
  buildRecordUpdate,
  buildSheetCorrection,
  buildSheetFinalize,
} from './attendance.builders';

const NOW = new Date('2026-06-01T12:00:00.000Z');

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

const MEMBER: MembershipRef = { id: 'mem-1', userId: 'user-1' };

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

function sheet(): AttendanceSheet {
  return {
    id: 'sheet-1',
    sessionId: 'ses-1',
    teamId: 'team-1',
    seasonId: 'season-1',
    state: AttendanceState.Finalized,
    finalizedAt: NOW,
    finalizedBy: 'coach-1',
    createdBy: 'coach-1',
    updatedBy: null,
    createdAt: NOW,
    updatedAt: NOW,
    version: 2,
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

describe('write-model builders', () => {
  it('builds a new sheet from a session', () => {
    expect(buildNewSheet('sheet-9', session(), 'coach-1', NOW)).toEqual({
      id: 'sheet-9',
      sessionId: 'ses-1',
      teamId: 'team-1',
      seasonId: 'season-1',
      createdBy: 'coach-1',
      now: NOW,
    });
  });

  it('builds a new record and a version-guarded update', () => {
    const newRecord = buildNewRecord('rec-9', context());
    expect(newRecord).toMatchObject({
      id: 'rec-9',
      sheetId: 'sheet-1',
      status: AttendanceStatus.PresentOnTime,
      recordedBy: 'coach-1',
    });
    const update = buildRecordUpdate(record({ version: 4 }), context());
    expect(update).toMatchObject({ id: 'rec-1', expectedVersion: 4 });
  });

  it('builds the finalize and correction sheet writes', () => {
    expect(buildSheetFinalize('sheet-1', 2, 'coach-1', NOW)).toEqual({
      id: 'sheet-1',
      finalizedBy: 'coach-1',
      expectedVersion: 2,
      now: NOW,
    });
    expect(buildSheetCorrection('sheet-1', 'coach-1', NOW)).toEqual({
      id: 'sheet-1',
      updatedBy: 'coach-1',
      now: NOW,
    });
  });
});

describe('buildAttendanceRevision', () => {
  it('carries a null from-status for a first mark', () => {
    const revision = buildAttendanceRevision(
      'rev-1',
      null,
      record(),
      context(),
    );
    expect(revision.fromStatus).toBeNull();
    expect(revision.toStatus).toBe(AttendanceStatus.PresentOnTime);
  });

  it('carries the previous status for a change', () => {
    const previous = record({ status: AttendanceStatus.Absent });
    const revision = buildAttendanceRevision(
      'rev-2',
      previous,
      record({ status: AttendanceStatus.PresentLate }),
      context({ isCorrection: true, correctionReason: 'fix' }),
    );
    expect(revision.fromStatus).toBe(AttendanceStatus.Absent);
    expect(revision.toStatus).toBe(AttendanceStatus.PresentLate);
    expect(revision.isCorrection).toBe(true);
    expect(revision.correctionReason).toBe('fix');
  });
});

describe('context builders', () => {
  it('builds a coach mark context', () => {
    const ctx = buildMarkContext(
      'sheet-1',
      session(),
      MEMBER,
      {
        membershipId: 'mem-1',
        status: AttendanceStatus.PresentLate,
        checkInAt: NOW,
        checkOutAt: null,
        latenessMinutes: 5,
        excuseCategory: null,
        note: 'late bus',
        evidenceRef: null,
        expectedVersion: 3,
      },
      'coach-1',
      NOW,
    );
    expect(ctx).toMatchObject({
      source: AttendanceSource.Coach,
      isCorrection: false,
      status: AttendanceStatus.PresentLate,
      latenessMinutes: 5,
      expectedVersion: 3,
    });
  });

  it('builds a self check-in context from a derivation', () => {
    const ctx = buildCheckInContext(
      'sheet-1',
      session(),
      MEMBER,
      { status: AttendanceStatus.PresentLate, latenessMinutes: 4 },
      'here',
      'user-1',
      NOW,
    );
    expect(ctx).toMatchObject({
      source: AttendanceSource.Self,
      checkInAt: NOW,
      status: AttendanceStatus.PresentLate,
      latenessMinutes: 4,
      note: 'here',
      expectedVersion: null,
    });
  });

  it('builds a correction context carrying the reason', () => {
    const command: CorrectAttendanceCommand = {
      status: AttendanceStatus.Excused,
      checkInAt: null,
      checkOutAt: null,
      latenessMinutes: null,
      excuseCategory: AttendanceExcuseCategory.Illness,
      note: null,
      evidenceRef: null,
      correctionReason: 'doctor note',
      expectedVersion: 2,
    };
    const ctx = buildCorrectionContext(
      'sheet-1',
      session(),
      MEMBER,
      command,
      'admin-1',
      NOW,
    );
    expect(ctx).toMatchObject({
      source: AttendanceSource.Coach,
      isCorrection: true,
      correctionReason: 'doctor note',
      status: AttendanceStatus.Excused,
      excuseCategory: AttendanceExcuseCategory.Illness,
    });
  });
});

describe('buildRecordAudit', () => {
  it('uses the corrected action for a correction', () => {
    const audit = buildRecordAudit(context({ isCorrection: true }), record());
    expect(audit.action).toBe(ATTENDANCE_CORRECTED_ACTION);
    expect(audit.diff).toMatchObject({ isCorrection: true });
  });

  it('uses the checked-in action for a self source', () => {
    const audit = buildRecordAudit(
      context({ source: AttendanceSource.Self }),
      record({ source: AttendanceSource.Self }),
    );
    expect(audit.action).toBe(ATTENDANCE_CHECKED_IN_ACTION);
  });

  it('uses the recorded action for a coach source', () => {
    const audit = buildRecordAudit(context(), record());
    expect(audit.action).toBe(ATTENDANCE_RECORDED_ACTION);
  });
});

describe('sheet audits and events', () => {
  it('builds a bulk audit with the applied count', () => {
    expect(buildBulkAudit('coach-1', sheet(), 7).diff).toEqual({ count: 7 });
  });

  it('builds a finalize audit for the sheet', () => {
    const audit = buildFinalizeAudit('coach-1', sheet());
    expect(audit.resourceId).toBe('sheet-1');
    expect(audit.diff).toEqual({ state: AttendanceState.Finalized });
  });

  it('builds a finalized event with the record count', () => {
    const event = buildFinalizedEvent('coach-1', sheet(), 12);
    expect(event.eventType).toBe(ATTENDANCE_FINALIZED_EVENT);
    expect(event.payload).toMatchObject({
      recordCount: 12,
      sessionId: 'ses-1',
    });
  });

  it('builds a corrected event addressed to the affected member', () => {
    const event = buildCorrectedEvent('coach-1', sheet(), record());
    expect(event.eventType).toBe(ATTENDANCE_CORRECTED_EVENT);
    expect(event.payload).toMatchObject({
      membershipId: 'mem-1',
      recipientUserId: 'user-1',
    });
  });
});
