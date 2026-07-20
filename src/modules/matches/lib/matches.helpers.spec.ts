import { describe, expect, it } from 'vitest';

import { MatchStatus } from '../model/matches.enums';
import {
  orDefault,
  orNull,
  parseEnumValue,
  parseNullableEnumValue,
  resolveEventsPage,
  resolveMatchesPage,
  toDate,
  toInstant,
  toNullableDate,
  toNullableNumber,
  toNumber,
  toOptionalInstant,
} from './matches.helpers';

const STATUSES: readonly MatchStatus[] = [MatchStatus.Live, MatchStatus.Ready];

describe('matches helpers', () => {
  it('defaults and hard-bounds the match list page', () => {
    expect(resolveMatchesPage(undefined, undefined)).toEqual({
      limit: 20,
      offset: 0,
    });
    expect(resolveMatchesPage(5000, 40)).toEqual({ limit: 100, offset: 40 });
  });

  it('defaults and hard-bounds the event feed page', () => {
    expect(resolveEventsPage(undefined, undefined)).toEqual({
      limit: 200,
      offset: 0,
    });
    expect(resolveEventsPage(5000, 10)).toEqual({ limit: 500, offset: 10 });
  });

  it('coerces instants both ways and preserves null', () => {
    const date = new Date('2026-03-01T10:00:00.000Z');
    expect(toDate(date)).toBe(date);
    expect(toDate('2026-03-01T10:00:00.000Z').toISOString()).toBe(
      '2026-03-01T10:00:00.000Z',
    );
    expect(toNullableDate(null)).toBeNull();
    expect(toNullableDate(date)).toBe(date);
    expect(toInstant(null)).toBeNull();
    expect(toInstant(date)).toBe('2026-03-01T10:00:00.000Z');
    expect(toOptionalInstant(null)).toBeNull();
    expect(toOptionalInstant('2026-03-01T10:00:00.000Z')?.getTime()).toBe(
      date.getTime(),
    );
  });

  it('coerces numeric columns and preserves null as "does not apply"', () => {
    expect(toNumber(7)).toBe(7);
    expect(toNumber('7')).toBe(7);
    expect(toNullableNumber(null)).toBeNull();
    expect(toNullableNumber('9')).toBe(9);
  });

  it('parses a raw column against the closed enum set', () => {
    expect(parseEnumValue(STATUSES, 'live', 'status')).toBe(MatchStatus.Live);
    expect(() => parseEnumValue(STATUSES, 'nonsense', 'status')).toThrow(
      'Unrecognized status: nonsense',
    );
    expect(parseNullableEnumValue(STATUSES, null, 'status')).toBeNull();
    expect(parseNullableEnumValue(STATUSES, 'ready', 'status')).toBe(
      MatchStatus.Ready,
    );
  });

  it('collapses an absent transport field onto an explicit null', () => {
    expect(orNull(undefined)).toBeNull();
    expect(orNull(null)).toBeNull();
    expect(orNull(3)).toBe(3);
    expect(orNull(0)).toBe(0);
  });

  it('applies a documented default only when the field is absent', () => {
    expect(orDefault(undefined, 1)).toBe(1);
    expect(orDefault(null, 1)).toBe(1);
    expect(orDefault(0, 1)).toBe(0);
  });
});
