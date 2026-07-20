/**
 * Read-only practice/attendance signals published for cross-module dashboards.
 * Every count is null when the underlying set is empty — never a zero standing
 * in for "no data" — and every signal carries the freshness instant it was
 * measured from so a widget can state its own as-of time.
 */

/** One upcoming published session and whether the viewer has answered it. */
export interface UpcomingSessionSignal {
  readonly sessionId: string;
  readonly startsAt: Date;
  readonly hasRsvp: boolean;
}

/** How many times the viewer was recorded with one attendance status. */
export interface AttendanceStatusCount {
  readonly status: string;
  readonly count: number;
}

/** A bounded count with the instant that makes it fresh. */
export interface PracticeCountSignal {
  readonly count: number | null;
  readonly asOf: Date | null;
}

/** Everything the dashboard needs from the practices context, in one read. */
export interface PracticeDashboardSignals {
  readonly upcomingSessions: readonly UpcomingSessionSignal[];
  readonly attendanceCounts: readonly AttendanceStatusCount[];
  readonly attendanceAsOf: Date | null;
  readonly draftSessions: PracticeCountSignal;
  readonly openAttendanceSheets: PracticeCountSignal;
}

/** Scope for a dashboard signal read: always one team, optionally one viewer. */
export interface PracticeSignalScope {
  readonly teamId: string;
  readonly membershipId: string | null;
}
