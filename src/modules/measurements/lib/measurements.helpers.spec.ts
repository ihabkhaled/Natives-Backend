import { describe, expect, it } from 'vitest';

import {
  parseEnumValue,
  resolveMeasurementsPage,
  roundNullable,
  toDate,
  toNullableDate,
  toNullableNumber,
} from './measurements.helpers';

describe('resolveMeasurementsPage', () => {
  it('applies defaults and clamps the limit to the maximum', () => {
    expect(resolveMeasurementsPage(undefined, undefined)).toEqual({
      limit: 20,
      offset: 0,
    });
    expect(resolveMeasurementsPage(500, 40)).toEqual({
      limit: 100,
      offset: 40,
    });
  });
});

describe('date + number helpers', () => {
  it('coerces strings and Dates', () => {
    const date = new Date('2026-06-01T00:00:00.000Z');
    expect(toDate(date)).toBe(date);
    expect(toDate('2026-06-01T00:00:00.000Z').getTime()).toBe(date.getTime());
    expect(toNullableDate(null)).toBeNull();
    expect(toNullableDate('2026-06-01T00:00:00.000Z')?.getTime()).toBe(
      date.getTime(),
    );
    expect(toNullableNumber(null)).toBeNull();
    expect(toNullableNumber('4.5')).toBe(4.5);
  });
});

describe('parseEnumValue', () => {
  it('returns a recognized value and throws otherwise', () => {
    expect(parseEnumValue(['a', 'b'] as const, 'b', 'label')).toBe('b');
    expect(() => parseEnumValue(['a'] as const, 'z', 'label')).toThrow(
      'Unrecognized label: z',
    );
  });
});

describe('roundNullable', () => {
  it('keeps null null and rounds a number half-up', () => {
    expect(roundNullable(null, 2)).toBeNull();
    expect(roundNullable(3.14159, 2)).toBe(3.14);
  });
});
