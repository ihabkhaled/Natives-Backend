import { describe, expect, it } from 'vitest';

import {
  AttendanceRuleStatus,
  AttendanceSource,
  AttendanceState,
  AttendanceStatus,
} from '../model/attendance.enums';
import type {
  AttendanceRecord,
  AttendanceSheet,
  ParticipationInputs,
  RosterEntry,
} from '../model/attendance.types';
import {
  notRecordedView,
  toAttendanceView,
  toParticipationView,
  toSheetStatusView,
  toSheetView,
} from './attendance.mapper';

const NOW = new Date('2026-06-01T12:00:00.000Z');

function record(): AttendanceRecord {
  return {
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
    latenessMinutes: 5,
    excuseCategory: null,
    note: 'secret',
    evidenceRef: null,
    source: AttendanceSource.Coach,
    recordedBy: 'coach-1',
    recordedAt: NOW,
    createdBy: 'coach-1',
    updatedBy: null,
    createdAt: NOW,
    updatedAt: NOW,
    version: 2,
  };
}

function inputs(
  overrides: Partial<ParticipationInputs> = {},
): ParticipationInputs {
  return {
    ruleVersion: 'legacy-candidate-v1',
    ruleStatus: AttendanceRuleStatus.Candidate,
    eligibleSessions: 8,
    attended: 6,
    onTime: 5,
    late: 1,
    excused: 1,
    injured: 0,
    absent: 1,
    remoteApproved: 0,
    otherApproved: 0,
    excludedSessions: 1,
    denominator: 7,
    attendanceRate: 0.75,
    weightedPresentPoints: 18,
    latePenaltyPoints: 1,
    absentPenaltyPoints: 1,
    pointsContribution: 16,
    ...overrides,
  };
}

describe('toAttendanceView', () => {
  it('projects a record without leaking the note', () => {
    const view = toAttendanceView(record());
    expect(view).toEqual({
      sessionId: 'ses-1',
      membershipId: 'mem-1',
      status: AttendanceStatus.PresentLate,
      checkInAt: NOW,
      checkOutAt: null,
      latenessMinutes: 5,
      excuseCategory: null,
      source: AttendanceSource.Coach,
      recordedAt: NOW,
      version: 2,
    });
    expect(Object.keys(view)).not.toContain('note');
  });
});

describe('notRecordedView', () => {
  it('models absence as a null status', () => {
    expect(notRecordedView('ses-1', 'mem-1')).toEqual({
      sessionId: 'ses-1',
      membershipId: 'mem-1',
      status: null,
      checkInAt: null,
      checkOutAt: null,
      latenessMinutes: null,
      excuseCategory: null,
      source: null,
      recordedAt: null,
      version: null,
    });
  });
});

describe('toSheetView', () => {
  const items: readonly RosterEntry[] = [
    {
      membershipId: 'mem-1',
      userId: 'user-1',
      status: null,
      checkInAt: null,
      latenessMinutes: null,
      excuseCategory: null,
      source: null,
      version: null,
    },
  ];

  it('defaults to open when no sheet exists yet', () => {
    const view = toSheetView('ses-1', null, items, 1, { limit: 20, offset: 0 });
    expect(view.state).toBe(AttendanceState.Open);
    expect(view.finalizedAt).toBeNull();
    expect(view.version).toBeNull();
    expect(view.total).toBe(1);
  });

  it('reflects the sheet state and finalized instant', () => {
    const sheet: AttendanceSheet = {
      id: 'sheet-1',
      sessionId: 'ses-1',
      teamId: 'team-1',
      seasonId: null,
      state: AttendanceState.Finalized,
      finalizedAt: NOW,
      finalizedBy: 'coach-1',
      createdBy: 'coach-1',
      updatedBy: null,
      createdAt: NOW,
      updatedAt: NOW,
      version: 2,
    };
    const view = toSheetView('ses-1', sheet, items, 1, {
      limit: 20,
      offset: 0,
    });
    expect(view.state).toBe(AttendanceState.Finalized);
    expect(view.finalizedAt).toBe(NOW);
    expect(view.version).toBe(2);
  });
});

describe('toSheetStatusView', () => {
  it('projects the finalize status with the record count', () => {
    const sheet: AttendanceSheet = {
      id: 'sheet-1',
      sessionId: 'ses-1',
      teamId: 'team-1',
      seasonId: null,
      state: AttendanceState.Finalized,
      finalizedAt: NOW,
      finalizedBy: 'coach-1',
      createdBy: 'coach-1',
      updatedBy: null,
      createdAt: NOW,
      updatedAt: NOW,
      version: 3,
    };
    expect(toSheetStatusView(sheet, 9)).toEqual({
      sessionId: 'ses-1',
      state: AttendanceState.Finalized,
      finalizedAt: NOW,
      recordCount: 9,
      version: 3,
    });
  });
});

describe('toParticipationView', () => {
  it('rounds the rate to a display percentage', () => {
    const view = toParticipationView('mem-1', 'season-1', inputs());
    expect(view.membershipId).toBe('mem-1');
    expect(view.seasonId).toBe('season-1');
    expect(view.attendanceRate).toBe(0.75);
    expect(view.attendanceRatePercent).toBe(75);
  });

  it('keeps a null percentage when the rate is null', () => {
    const view = toParticipationView(
      'mem-1',
      null,
      inputs({ attendanceRate: null, pointsContribution: null }),
    );
    expect(view.attendanceRatePercent).toBeNull();
  });

  it('rounds a repeating rate to one decimal place', () => {
    const view = toParticipationView(
      'mem-1',
      null,
      inputs({ attendanceRate: 2 / 3 }),
    );
    expect(view.attendanceRatePercent).toBe(66.7);
  });
});
