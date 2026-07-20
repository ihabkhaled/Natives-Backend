import { describe, expect, it } from 'vitest';

import { LeaderboardPeriod } from '../model/leaderboard.enums';
import type { PeriodWindow } from '../model/leaderboard.types';
import {
  cairoDateParts,
  cairoMidnightUtc,
  cairoOffsetMs,
  computePeriodWindows,
  readPart,
  shiftDate,
} from './leaderboard-window';

function defined(instant: Date | null): Date {
  if (instant === null) {
    throw new Error('expected a bounded instant');
  }
  return instant;
}

function dowUtc(instant: Date): number {
  const parts = cairoDateParts(instant);
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay();
}

const JULY = new Date('2026-07-19T10:00:00.000Z');

describe('readPart', () => {
  it('returns 0 for an absent field and the number for a present one', () => {
    expect(readPart([], 'year')).toBe(0);
    expect(readPart([{ type: 'year', value: '2026' }], 'year')).toBe(2026);
  });
});

describe('cairoDateParts / cairoOffsetMs', () => {
  it('reads the Cairo calendar date and a positive (east of UTC) offset', () => {
    expect(cairoDateParts(JULY)).toEqual({ year: 2026, month: 7, day: 19 });
    expect(cairoOffsetMs(JULY)).toBeGreaterThan(0);
  });
});

describe('shiftDate', () => {
  it('rolls across a month and a year boundary', () => {
    expect(shiftDate({ year: 2026, month: 1, day: 31 }, 1)).toEqual({
      year: 2026,
      month: 2,
      day: 1,
    });
    expect(shiftDate({ year: 2026, month: 1, day: 1 }, -1)).toEqual({
      year: 2025,
      month: 12,
      day: 31,
    });
  });
});

describe('cairoMidnightUtc', () => {
  it('resolves a normal Cairo midnight to the exact boundary instant', () => {
    const instant = cairoMidnightUtc({ year: 2026, month: 7, day: 1 });
    expect(cairoDateParts(instant)).toEqual({ year: 2026, month: 7, day: 1 });
    expect(cairoDateParts(new Date(instant.getTime() - 1))).toEqual({
      year: 2026,
      month: 6,
      day: 30,
    });
  });

  it('corrects a midnight that lands on the Cairo DST spring-forward', () => {
    const instant = cairoMidnightUtc({ year: 2026, month: 4, day: 24 });
    expect(cairoDateParts(instant)).toEqual({ year: 2026, month: 4, day: 24 });
  });
});

function atMidnight(
  window: PeriodWindow,
  date: {
    year: number;
    month: number;
    day: number;
  },
): void {
  expect(cairoDateParts(defined(window.startUtc))).toEqual(date);
}

describe('computePeriodWindows — monthly', () => {
  it('spans the Cairo calendar month with a previous month adjoining it', () => {
    const windows = computePeriodWindows(LeaderboardPeriod.Monthly, JULY, null);
    atMidnight(windows.current, { year: 2026, month: 7, day: 1 });
    expect(cairoDateParts(defined(windows.current.endUtc))).toEqual({
      year: 2026,
      month: 8,
      day: 1,
    });
    const previous = defined(windows.previous?.startUtc ?? null);
    expect(cairoDateParts(previous)).toEqual({ year: 2026, month: 6, day: 1 });
    expect(windows.previous?.endUtc).toEqual(windows.current.startUtc);
  });

  it('rolls the current month across December into the next January', () => {
    const december = new Date('2026-12-15T10:00:00.000Z');
    const windows = computePeriodWindows(
      LeaderboardPeriod.Monthly,
      december,
      null,
    );
    expect(cairoDateParts(defined(windows.current.endUtc))).toEqual({
      year: 2027,
      month: 1,
      day: 1,
    });
  });

  it('rolls the previous month across January into the prior December', () => {
    const january = new Date('2026-01-15T10:00:00.000Z');
    const windows = computePeriodWindows(
      LeaderboardPeriod.Monthly,
      january,
      null,
    );
    expect(cairoDateParts(defined(windows.previous?.startUtc ?? null))).toEqual(
      { year: 2025, month: 12, day: 1 },
    );
  });
});

describe('computePeriodWindows — weekly', () => {
  it('starts the current and previous windows on a Monday, 7 days apart', () => {
    const windows = computePeriodWindows(LeaderboardPeriod.Weekly, JULY, null);
    expect(dowUtc(defined(windows.current.startUtc))).toBe(1);
    expect(dowUtc(defined(windows.current.endUtc))).toBe(1);
    expect(dowUtc(defined(windows.previous?.startUtc ?? null))).toBe(1);
    expect(windows.previous?.endUtc).toEqual(windows.current.startUtc);
  });
});

describe('computePeriodWindows — season', () => {
  it('spans the inclusive season with no previous window', () => {
    const windows = computePeriodWindows(LeaderboardPeriod.Season, JULY, {
      startsOn: '2026-03-01',
      endsOn: '2026-05-31',
    });
    atMidnight(windows.current, { year: 2026, month: 3, day: 1 });
    expect(cairoDateParts(defined(windows.current.endUtc))).toEqual({
      year: 2026,
      month: 6,
      day: 1,
    });
    expect(windows.previous).toBeNull();
  });

  it('falls back to unbounded when a season window has no bounds', () => {
    const windows = computePeriodWindows(LeaderboardPeriod.Season, JULY, null);
    expect(windows.current.startUtc).toBeNull();
    expect(windows.current.endUtc).toBeNull();
    expect(windows.previous).toBeNull();
  });
});

describe('computePeriodWindows — all-time', () => {
  it('is unbounded with no previous window', () => {
    const windows = computePeriodWindows(LeaderboardPeriod.AllTime, JULY, null);
    expect(windows.current.startUtc).toBeNull();
    expect(windows.current.endUtc).toBeNull();
    expect(windows.previous).toBeNull();
  });
});
