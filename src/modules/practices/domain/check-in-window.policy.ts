import {
  CHECK_IN_CLOSES_AFTER_END_MINUTES,
  CHECK_IN_OPENS_BEFORE_START_MINUTES,
  MS_PER_MINUTE,
} from '../model/attendance.constants';
import {
  AttendanceState,
  CheckInWindowState,
  SelfCheckInState,
} from '../model/attendance.enums';
import type {
  CheckInWindow,
  SelfCheckInEligibility,
} from '../model/attendance.types';
import { SessionStatus } from '../model/practices.enums';
import type { PracticeSession } from '../model/practices.types';

/**
 * Pure self check-in window policy (decision D2): the window opens
 * `startsAt − 60 min` and closes at the session's resolved end instant, both
 * inclusive, computed on UTC instants (DST-agnostic). Only a live (published or
 * rescheduled) session is check-in-able — draft/cancelled/completed/archived
 * refuse regardless of time. Venue/geo/code policy is explicitly NONE (D11).
 * No side effects, no clock, no persistence.
 */

/** True when the session lifecycle state accepts self check-ins at all. */
export function isCheckInAbleStatus(status: SessionStatus): boolean {
  return (
    status === SessionStatus.Published || status === SessionStatus.Rescheduled
  );
}

/** Resolve the check-in window bounds + state for a session at one instant. */
export function resolveCheckInWindow(
  session: PracticeSession,
  now: Date,
): CheckInWindow {
  const opensAt = new Date(
    session.startsAt.getTime() -
      CHECK_IN_OPENS_BEFORE_START_MINUTES * MS_PER_MINUTE,
  );
  const closesAt = new Date(
    session.endsAt.getTime() +
      CHECK_IN_CLOSES_AFTER_END_MINUTES * MS_PER_MINUTE,
  );
  return {
    opensAt,
    closesAt,
    state: resolveWindowState(session, opensAt, closesAt, now),
  };
}

function resolveWindowState(
  session: PracticeSession,
  opensAt: Date,
  closesAt: Date,
  now: Date,
): CheckInWindowState {
  if (!isCheckInAbleStatus(session.status)) {
    return CheckInWindowState.Closed;
  }
  if (now.getTime() < opensAt.getTime()) {
    return CheckInWindowState.NotOpen;
  }
  return now.getTime() > closesAt.getTime()
    ? CheckInWindowState.Closed
    : CheckInWindowState.Open;
}

/**
 * Derive the full eligibility block the own-attendance read exposes: `recorded`
 * when a record already exists (repeat check-ins are no-ops), `locked` when the
 * sheet is finalized/corrected, otherwise the pure window state.
 */
export function deriveSelfCheckInEligibility(
  session: PracticeSession,
  sheetState: AttendanceState,
  hasRecord: boolean,
  now: Date,
): SelfCheckInEligibility {
  const window = resolveCheckInWindow(session, now);
  return {
    state: eligibilityState(window.state, sheetState, hasRecord),
    opensAt: window.opensAt,
    closesAt: window.closesAt,
  };
}

function eligibilityState(
  windowState: CheckInWindowState,
  sheetState: AttendanceState,
  hasRecord: boolean,
): SelfCheckInState {
  if (hasRecord) {
    return SelfCheckInState.Recorded;
  }
  if (sheetState !== AttendanceState.Open) {
    return SelfCheckInState.Locked;
  }
  return toSelfCheckInState(windowState);
}

function toSelfCheckInState(state: CheckInWindowState): SelfCheckInState {
  if (state === CheckInWindowState.NotOpen) {
    return SelfCheckInState.NotOpen;
  }
  return state === CheckInWindowState.Open
    ? SelfCheckInState.Open
    : SelfCheckInState.Closed;
}
