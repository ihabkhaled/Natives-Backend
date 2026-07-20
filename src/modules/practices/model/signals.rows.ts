/** Raw rows returned by the practices dashboard-signal SQL (snake_case). */

export interface UpcomingSessionSignalRow {
  readonly id: string;
  readonly starts_at: string | Date;
  readonly has_rsvp: boolean;
}

export interface AttendanceStatusCountRow {
  readonly status: string;
  readonly count: number;
  readonly latest_at: string | Date | null;
}

export interface SignalCountRow {
  readonly count: number;
  readonly boundary_at: string | Date | null;
}
