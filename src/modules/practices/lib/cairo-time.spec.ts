import { describe, expect, it } from 'vitest';

import {
  addMinutes,
  combineLocalDateTimeToUtc,
  getTimeZoneOffsetMs,
  readPart,
  zonedLocalToUtc,
} from './cairo-time';

const CAIRO = 'Africa/Cairo';
const HOUR_MS = 3_600_000;

describe('readPart', () => {
  it('reads a present numeric field', () => {
    expect(readPart([{ type: 'year', value: '2026' }], 'year')).toBe(2026);
  });

  it('defaults to zero for an absent field', () => {
    expect(readPart([], 'hour')).toBe(0);
  });
});

describe('getTimeZoneOffsetMs (Africa/Cairo, DST-aware)', () => {
  it('is +2h during standard time (January)', () => {
    const offset = getTimeZoneOffsetMs(
      new Date('2026-01-15T12:00:00.000Z'),
      CAIRO,
    );
    expect(offset).toBe(2 * HOUR_MS);
  });

  it('is +3h during summer time (July)', () => {
    const offset = getTimeZoneOffsetMs(
      new Date('2026-07-15T12:00:00.000Z'),
      CAIRO,
    );
    expect(offset).toBe(3 * HOUR_MS);
  });
});

describe('zonedLocalToUtc (Cairo local wall time -> UTC instant)', () => {
  it('maps a winter local evening at +2h (golden)', () => {
    const utc = zonedLocalToUtc(2026, 1, 15, 18, 0, CAIRO);
    expect(utc.toISOString()).toBe('2026-01-15T16:00:00.000Z');
  });

  it('maps a summer local evening at +3h (golden)', () => {
    const utc = zonedLocalToUtc(2026, 7, 15, 18, 0, CAIRO);
    expect(utc.toISOString()).toBe('2026-07-15T15:00:00.000Z');
  });

  it('resolves a local time inside the spring-forward gap deterministically', () => {
    const utc = zonedLocalToUtc(2026, 4, 24, 0, 30, CAIRO);
    expect(Number.isNaN(utc.getTime())).toBe(false);
  });
});

describe('combineLocalDateTimeToUtc', () => {
  it('combines a local date and HH:MM into the correct UTC instant', () => {
    const utc = combineLocalDateTimeToUtc('2026-07-15', '18:00', CAIRO);
    expect(utc.toISOString()).toBe('2026-07-15T15:00:00.000Z');
  });
});

describe('addMinutes', () => {
  it('shifts an instant forward and backward', () => {
    const base = new Date('2026-01-01T12:00:00.000Z');
    expect(addMinutes(base, 90).toISOString()).toBe('2026-01-01T13:30:00.000Z');
    expect(addMinutes(base, -30).toISOString()).toBe(
      '2026-01-01T11:30:00.000Z',
    );
  });
});
