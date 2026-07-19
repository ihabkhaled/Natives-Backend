import { describe, expect, it } from 'vitest';

import {
  parseEnumValue,
  resolveDevelopmentPage,
  toDate,
  toNullableDate,
  toNullableNumber,
} from './development.helpers';

describe('resolveDevelopmentPage', () => {
  it('applies defaults when no paging is supplied', () => {
    expect(resolveDevelopmentPage(undefined, undefined)).toEqual({
      limit: 20,
      offset: 0,
    });
  });

  it('clamps the limit to the hard maximum', () => {
    expect(resolveDevelopmentPage(1000, 5)).toEqual({ limit: 100, offset: 5 });
  });
});

describe('date and number helpers', () => {
  it('passes through a Date and parses a string', () => {
    const date = new Date('2026-01-01T00:00:00.000Z');
    expect(toDate(date)).toBe(date);
    expect(toDate('2026-01-01T00:00:00.000Z')).toEqual(date);
  });

  it('maps nullable dates and numbers', () => {
    expect(toNullableDate(null)).toBeNull();
    expect(toNullableDate('2026-01-01T00:00:00.000Z')).toEqual(
      new Date('2026-01-01T00:00:00.000Z'),
    );
    expect(toNullableNumber(null)).toBeNull();
    expect(toNullableNumber('4.5')).toBe(4.5);
  });
});

describe('parseEnumValue', () => {
  it('returns a recognised value', () => {
    expect(parseEnumValue(['a', 'b'] as const, 'b', 'letter')).toBe('b');
  });

  it('throws on an unrecognised value', () => {
    expect(() => parseEnumValue(['a'] as const, 'z', 'letter')).toThrow(
      'Unrecognized letter: z',
    );
  });
});
