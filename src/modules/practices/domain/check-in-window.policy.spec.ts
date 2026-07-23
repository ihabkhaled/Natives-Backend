import { describe, expect, it } from 'vitest';

import {
  AttendanceState,
  CheckInWindowState,
  SelfCheckInState,
} from '../model/attendance.enums';
import { SessionStatus, SessionVisibility } from '../model/practices.enums';
import type { PracticeSession } from '../model/practices.types';
import {
  deriveSelfCheckInEligibility,
  isCheckInAbleStatus,
  resolveCheckInWindow,
} from './check-in-window.policy';

const STARTS_AT = new Date('2026-06-01T15:00:00.000Z');
const ENDS_AT = new Date('2026-06-01T17:00:00.000Z');
const OPENS_AT = new Date('2026-06-01T14:00:00.000Z');

function session(
  status: SessionStatus = SessionStatus.Published,
): PracticeSession {
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
    startsAt: STARTS_AT,
    endsAt: ENDS_AT,
    rsvpCutoffAt: null,
    visibility: SessionVisibility.Team,
    organizerUserId: null,
    notes: null,
    status,
    cancellationReason: null,
    createdBy: null,
    updatedBy: null,
    createdAt: STARTS_AT,
    updatedAt: STARTS_AT,
    version: 1,
  };
}

describe('resolveCheckInWindow', () => {
  it('computes the UTC bounds: startsAt − 60 min through the session end', () => {
    const window = resolveCheckInWindow(session(), STARTS_AT);
    expect(window.opensAt).toEqual(OPENS_AT);
    expect(window.closesAt).toEqual(ENDS_AT);
  });

  it('is not_open one second before opensAt', () => {
    const now = new Date(OPENS_AT.getTime() - 1000);
    expect(resolveCheckInWindow(session(), now).state).toBe(
      CheckInWindowState.NotOpen,
    );
  });

  it('opens exactly at opensAt (inclusive)', () => {
    expect(resolveCheckInWindow(session(), OPENS_AT).state).toBe(
      CheckInWindowState.Open,
    );
  });

  it('stays open during the session and exactly at the end instant', () => {
    expect(resolveCheckInWindow(session(), STARTS_AT).state).toBe(
      CheckInWindowState.Open,
    );
    expect(resolveCheckInWindow(session(), ENDS_AT).state).toBe(
      CheckInWindowState.Open,
    );
  });

  it('closes one second after the session end', () => {
    const now = new Date(ENDS_AT.getTime() + 1000);
    expect(resolveCheckInWindow(session(), now).state).toBe(
      CheckInWindowState.Closed,
    );
  });

  it('is closed for a cancelled or draft session regardless of time', () => {
    expect(
      resolveCheckInWindow(session(SessionStatus.Cancelled), STARTS_AT).state,
    ).toBe(CheckInWindowState.Closed);
    expect(
      resolveCheckInWindow(session(SessionStatus.Draft), STARTS_AT).state,
    ).toBe(CheckInWindowState.Closed);
  });

  it('treats published and rescheduled as the only check-in-able statuses', () => {
    expect(isCheckInAbleStatus(SessionStatus.Published)).toBe(true);
    expect(isCheckInAbleStatus(SessionStatus.Rescheduled)).toBe(true);
    expect(isCheckInAbleStatus(SessionStatus.Draft)).toBe(false);
    expect(isCheckInAbleStatus(SessionStatus.Cancelled)).toBe(false);
    expect(isCheckInAbleStatus(SessionStatus.Completed)).toBe(false);
    expect(isCheckInAbleStatus(SessionStatus.Archived)).toBe(false);
  });
});

describe('deriveSelfCheckInEligibility', () => {
  it('reports recorded whenever a record exists, even after close', () => {
    const now = new Date(ENDS_AT.getTime() + 1000);
    const block = deriveSelfCheckInEligibility(
      session(),
      AttendanceState.Open,
      true,
      now,
    );
    expect(block.state).toBe(SelfCheckInState.Recorded);
    expect(block.opensAt).toEqual(OPENS_AT);
    expect(block.closesAt).toEqual(ENDS_AT);
  });

  it('reports locked for a finalized or corrected sheet without a record', () => {
    expect(
      deriveSelfCheckInEligibility(
        session(),
        AttendanceState.Finalized,
        false,
        STARTS_AT,
      ).state,
    ).toBe(SelfCheckInState.Locked);
    expect(
      deriveSelfCheckInEligibility(
        session(),
        AttendanceState.Corrected,
        false,
        STARTS_AT,
      ).state,
    ).toBe(SelfCheckInState.Locked);
  });

  it('falls through to the window state on an open sheet', () => {
    const early = new Date(OPENS_AT.getTime() - 1000);
    const late = new Date(ENDS_AT.getTime() + 1000);
    expect(
      deriveSelfCheckInEligibility(
        session(),
        AttendanceState.Open,
        false,
        early,
      ).state,
    ).toBe(SelfCheckInState.NotOpen);
    expect(
      deriveSelfCheckInEligibility(
        session(),
        AttendanceState.Open,
        false,
        STARTS_AT,
      ).state,
    ).toBe(SelfCheckInState.Open);
    expect(
      deriveSelfCheckInEligibility(session(), AttendanceState.Open, false, late)
        .state,
    ).toBe(SelfCheckInState.Closed);
  });
});
