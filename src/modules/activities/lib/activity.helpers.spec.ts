import { describe, expect, it } from 'vitest';

import {
  buildAbuseProbeWindow,
  parseEnumValue,
  resolveActivityPage,
  subtractDays,
  toCalendarDay,
  toDate,
  toNullableDate,
  toNullableNumber,
} from './activity.helpers';

describe('activity.helpers', () => {
  it('resolves defaults and clamps the page to the maximum', () => {
    expect(resolveActivityPage(undefined, undefined)).toEqual({
      limit: 20,
      offset: 0,
    });
    expect(resolveActivityPage(500, 40)).toEqual({ limit: 100, offset: 40 });
    expect(resolveActivityPage(10, 5)).toEqual({ limit: 10, offset: 5 });
  });

  it('coerces database timestamps to Date instances', () => {
    const date = new Date('2024-01-02T03:04:05.000Z');
    expect(toDate(date)).toBe(date);
    expect(toDate('2024-01-02T03:04:05.000Z')).toEqual(date);
  });

  it('preserves nulls when coercing nullable dates and numbers', () => {
    expect(toNullableDate(null)).toBeNull();
    expect(toNullableDate('2024-01-02T00:00:00.000Z')).toEqual(
      new Date('2024-01-02T00:00:00.000Z'),
    );
    expect(toNullableNumber(null)).toBeNull();
    expect(toNullableNumber('12.5')).toBe(12.5);
  });

  it('renders the UTC calendar day of an instant', () => {
    expect(toCalendarDay(new Date('2024-06-01T23:30:00.000Z'))).toBe(
      '2024-06-01',
    );
  });

  it('parses a known enum value and throws on an unknown one', () => {
    expect(parseEnumValue(['a', 'b'] as const, 'b', 'label')).toBe('b');
    expect(() => parseEnumValue(['a'] as const, 'z', 'label')).toThrow(
      'Unrecognized label: z',
    );
  });

  it('subtracts whole UTC days across a month boundary', () => {
    expect(subtractDays('2024-06-02', 7)).toBe('2024-05-26');
    expect(subtractDays('2024-06-02', 30)).toBe('2024-05-03');
    expect(subtractDays('2024-03-01', 1)).toBe('2024-02-29');
  });

  it('builds the anti-abuse probe window relative to today', () => {
    expect(buildAbuseProbeWindow('2024-06-02')).toEqual({
      windowFrom: '2024-05-26',
      windowTo: '2024-06-02',
      buddyFrom: '2024-05-03',
    });
  });
});
