import { describe, expect, it } from 'vitest';

import {
  latestAttendanceInstant,
  toAttendanceStatusCount,
  toCountSignal,
  toUpcomingSession,
} from './signals.mapper';

describe('toUpcomingSession', () => {
  it('maps a session row, parsing the timestamp string', () => {
    expect(
      toUpcomingSession({
        id: 'session-1',
        starts_at: '2026-07-21T17:00:00.000Z',
        has_rsvp: false,
      }),
    ).toEqual({
      sessionId: 'session-1',
      startsAt: new Date('2026-07-21T17:00:00.000Z'),
      hasRsvp: false,
    });
  });

  it('accepts a driver-supplied Date without re-parsing it', () => {
    const startsAt = new Date('2026-07-21T17:00:00.000Z');

    expect(
      toUpcomingSession({ id: 's', starts_at: startsAt, has_rsvp: true })
        .startsAt,
    ).toBe(startsAt);
  });
});

describe('toAttendanceStatusCount', () => {
  it('keeps the status and its count', () => {
    expect(
      toAttendanceStatusCount({
        status: 'present',
        count: 8,
        latest_at: null,
      }),
    ).toEqual({ status: 'present', count: 8 });
  });
});

describe('toCountSignal', () => {
  it('reports a real count with its boundary instant', () => {
    expect(
      toCountSignal([{ count: 3, boundary_at: '2026-07-01T00:00:00.000Z' }]),
    ).toEqual({ count: 3, asOf: new Date('2026-07-01T00:00:00.000Z') });
  });

  it('reports null rather than zero for an empty aggregate', () => {
    expect(toCountSignal([{ count: 0, boundary_at: null }])).toEqual({
      count: null,
      asOf: null,
    });
  });

  it('reports null when no aggregate row came back', () => {
    expect(toCountSignal([])).toEqual({ count: null, asOf: null });
  });

  it('keeps a count whose boundary is unknown', () => {
    expect(toCountSignal([{ count: 4, boundary_at: null }])).toEqual({
      count: 4,
      asOf: null,
    });
  });
});

describe('latestAttendanceInstant', () => {
  it('picks the most recent instant across grouped rows', () => {
    expect(
      latestAttendanceInstant([
        { status: 'present', count: 1, latest_at: '2026-07-01T00:00:00.000Z' },
        { status: 'late', count: 1, latest_at: '2026-07-05T00:00:00.000Z' },
        { status: 'absent', count: 1, latest_at: null },
      ]),
    ).toEqual(new Date('2026-07-05T00:00:00.000Z'));
  });

  it('keeps the earlier instant when the later row is older', () => {
    expect(
      latestAttendanceInstant([
        { status: 'present', count: 1, latest_at: '2026-07-05T00:00:00.000Z' },
        { status: 'late', count: 1, latest_at: '2026-07-01T00:00:00.000Z' },
      ]),
    ).toEqual(new Date('2026-07-05T00:00:00.000Z'));
  });

  it('is null when nothing has ever been recorded', () => {
    expect(latestAttendanceInstant([])).toBeNull();
  });
});
