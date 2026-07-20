import type {
  AttendanceStatusCountRow,
  SignalCountRow,
  UpcomingSessionSignalRow,
} from '../model/signals.rows';
import type {
  AttendanceStatusCount,
  PracticeCountSignal,
  UpcomingSessionSignal,
} from '../model/signals.types';

function toDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

function toNullableDate(value: string | Date | null): Date | null {
  return value === null ? null : toDate(value);
}

export function toUpcomingSession(
  row: UpcomingSessionSignalRow,
): UpcomingSessionSignal {
  return {
    sessionId: row.id,
    startsAt: toDate(row.starts_at),
    hasRsvp: row.has_rsvp,
  };
}

export function toAttendanceStatusCount(
  row: AttendanceStatusCountRow,
): AttendanceStatusCount {
  return { status: row.status, count: row.count };
}

/**
 * Interpret an aggregate count row as a signal. An aggregate over an empty set
 * returns one row with count 0 — that means "nothing to report", so the signal
 * is null rather than a zero the client would render as a real measurement.
 */
export function toCountSignal(
  rows: readonly SignalCountRow[],
): PracticeCountSignal {
  const row = rows[0];
  if (row === undefined || row.count === 0) {
    return { count: null, asOf: null };
  }
  return { count: row.count, asOf: toNullableDate(row.boundary_at) };
}

/** The most recent measurement instant across grouped rows, or null. */
export function latestAttendanceInstant(
  rows: readonly AttendanceStatusCountRow[],
): Date | null {
  let latest: Date | null = null;
  for (const row of rows) {
    const candidate = toNullableDate(row.latest_at);
    if (candidate !== null && (latest === null || candidate > latest)) {
      latest = candidate;
    }
  }
  return latest;
}
