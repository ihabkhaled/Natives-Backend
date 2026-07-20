import { describe, expect, it } from 'vitest';

import {
  parseEnumValue,
  resolveCompetitionsPage,
  toCairoDateOnly,
  toCairoWallClock,
  toDate,
  toNullableDate,
} from './competitions.helpers';

describe('competitions helpers', () => {
  it('clamps paging to the bounded window and applies defaults', () => {
    expect(resolveCompetitionsPage(undefined, undefined)).toEqual({
      limit: 20,
      offset: 0,
    });
    expect(resolveCompetitionsPage(5000, 40)).toEqual({
      limit: 100,
      offset: 40,
    });
    expect(resolveCompetitionsPage(10, 0)).toEqual({ limit: 10, offset: 0 });
  });

  it('coerces database instants to dates, preserving nulls', () => {
    const date = new Date('2026-05-01T00:00:00.000Z');
    expect(toDate(date)).toBe(date);
    expect(toDate('2026-05-01T00:00:00.000Z').getTime()).toBe(date.getTime());
    expect(toNullableDate(null)).toBeNull();
    expect(toNullableDate('2026-05-01T00:00:00.000Z')?.getTime()).toBe(
      date.getTime(),
    );
  });

  it('parses a known enum value and rejects an unknown one', () => {
    expect(parseEnumValue(['a', 'b'] as const, 'b', 'letter')).toBe('b');
    expect(() => parseEnumValue(['a', 'b'] as const, 'z', 'letter')).toThrow(
      'Unrecognized letter: z',
    );
  });

  it('presents a UTC instant in Africa/Cairo (winter, UTC+2)', () => {
    const instant = new Date('2026-01-15T18:30:00.000Z');
    expect(toCairoDateOnly(instant)).toBe('2026-01-15');
    expect(toCairoWallClock(instant)).toBe('2026-01-15T20:30');
  });

  it('rolls the Cairo calendar day across the UTC boundary', () => {
    const instant = new Date('2026-01-15T23:30:00.000Z');
    expect(toCairoDateOnly(instant)).toBe('2026-01-16');
    expect(toCairoWallClock(instant)).toBe('2026-01-16T01:30');
  });

  it('normalizes Cairo midnight to 00:00 rather than 24:00', () => {
    const instant = new Date('2026-01-15T22:00:00.000Z');
    expect(toCairoWallClock(instant)).toBe('2026-01-16T00:00');
  });
});
