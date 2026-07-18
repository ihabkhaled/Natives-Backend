import { describe, expect, it } from 'vitest';

import {
  AttendanceExcuseCategory,
  AttendanceRuleStatus,
  AttendanceSource,
  AttendanceState,
  AttendanceStatus,
} from '../model/attendance.enums';
import {
  deriveCheckInStatus,
  hasDuplicateMembership,
  isMarkConsistent,
  parseAttendanceSource,
  parseAttendanceState,
  parseAttendanceStatus,
  parseExcuseCategory,
  parseNullableAttendanceSource,
  parseNullableAttendanceStatus,
  parseNullableInstant,
  parseRuleStatus,
  parseWeights,
  resolveAttendancePage,
  toIsoOrNull,
} from './attendance.helpers';

describe('parse* helpers', () => {
  it('maps valid persisted strings to enums', () => {
    expect(parseAttendanceStatus('present_on_time')).toBe(
      AttendanceStatus.PresentOnTime,
    );
    expect(parseAttendanceState('finalized')).toBe(AttendanceState.Finalized);
    expect(parseAttendanceSource('coach')).toBe(AttendanceSource.Coach);
    expect(parseRuleStatus('candidate')).toBe(AttendanceRuleStatus.Candidate);
    expect(parseExcuseCategory('injury')).toBe(AttendanceExcuseCategory.Injury);
  });

  it('preserves null for nullable parsers', () => {
    expect(parseNullableAttendanceStatus(null)).toBeNull();
    expect(parseNullableAttendanceStatus('absent')).toBe(
      AttendanceStatus.Absent,
    );
    expect(parseNullableAttendanceSource(null)).toBeNull();
    expect(parseNullableAttendanceSource('self')).toBe(AttendanceSource.Self);
    expect(parseExcuseCategory(null)).toBeNull();
  });

  it('throws on an unrecognized persisted value', () => {
    expect(() => parseAttendanceStatus('nope')).toThrow();
    expect(() => parseExcuseCategory('nope')).toThrow();
  });
});

describe('parseWeights', () => {
  it('keeps finite numeric entries and lowercases keys', () => {
    expect(parseWeights({ Practice: 3, GAME: 2 })).toEqual({
      practice: 3,
      game: 2,
    });
  });

  it('drops non-numeric and non-finite entries', () => {
    expect(parseWeights({ a: 1, b: 'x', c: Number.NaN })).toEqual({ a: 1 });
  });

  it('returns an empty map for a non-object', () => {
    expect(parseWeights(null)).toEqual({});
    expect(parseWeights('nope')).toEqual({});
  });
});

describe('resolveAttendancePage', () => {
  it('clamps to safe bounds', () => {
    expect(resolveAttendancePage({ limit: 9999, offset: -5 })).toEqual({
      limit: 100,
      offset: 0,
    });
    expect(resolveAttendancePage({})).toEqual({ limit: 20, offset: 0 });
  });
});

describe('deriveCheckInStatus', () => {
  const start = new Date('2026-06-01T15:00:00.000Z');

  it('is on-time (null lateness) at or before the start', () => {
    expect(
      deriveCheckInStatus(new Date('2026-06-01T14:59:00.000Z'), start),
    ).toEqual({
      status: AttendanceStatus.PresentOnTime,
      latenessMinutes: null,
    });
    expect(deriveCheckInStatus(start, start)).toEqual({
      status: AttendanceStatus.PresentOnTime,
      latenessMinutes: null,
    });
  });

  it('is present-late with measured minutes (rounded up, at least one)', () => {
    expect(
      deriveCheckInStatus(new Date('2026-06-01T15:05:00.000Z'), start),
    ).toEqual({ status: AttendanceStatus.PresentLate, latenessMinutes: 5 });
    expect(
      deriveCheckInStatus(new Date('2026-06-01T15:00:30.000Z'), start),
    ).toEqual({ status: AttendanceStatus.PresentLate, latenessMinutes: 1 });
  });

  it('clamps extreme lateness to the maximum', () => {
    const result = deriveCheckInStatus(
      new Date('2026-06-05T15:00:00.000Z'),
      start,
    );
    expect(result.latenessMinutes).toBe(1440);
  });
});

describe('isMarkConsistent', () => {
  it('accepts a present-late mark with lateness', () => {
    expect(isMarkConsistent(AttendanceStatus.PresentLate, 10, null)).toBe(true);
  });

  it('accepts an excused mark with an excuse category', () => {
    expect(
      isMarkConsistent(
        AttendanceStatus.Excused,
        null,
        AttendanceExcuseCategory.Work,
      ),
    ).toBe(true);
  });

  it('accepts an on-time mark with no lateness or excuse', () => {
    expect(isMarkConsistent(AttendanceStatus.PresentOnTime, null, null)).toBe(
      true,
    );
  });

  it('rejects lateness on a non-late status', () => {
    expect(isMarkConsistent(AttendanceStatus.PresentOnTime, 5, null)).toBe(
      false,
    );
  });

  it('rejects an excuse category on a non-excused status', () => {
    expect(
      isMarkConsistent(
        AttendanceStatus.Absent,
        null,
        AttendanceExcuseCategory.Other,
      ),
    ).toBe(false);
  });
});

describe('hasDuplicateMembership', () => {
  it('detects a duplicate id in the list', () => {
    expect(hasDuplicateMembership(['a', 'b', 'a'])).toBe(true);
    expect(hasDuplicateMembership(['a', 'b', 'c'])).toBe(false);
  });
});

describe('date serialization helpers', () => {
  it('serializes a nullable instant to ISO or null', () => {
    expect(toIsoOrNull(null)).toBeNull();
    expect(toIsoOrNull(new Date('2026-06-01T15:00:00.000Z'))).toBe(
      '2026-06-01T15:00:00.000Z',
    );
  });

  it('parses an optional instant string to a Date or null', () => {
    expect(parseNullableInstant(undefined)).toBeNull();
    expect(parseNullableInstant('2026-06-01T15:00:00.000Z')).toEqual(
      new Date('2026-06-01T15:00:00.000Z'),
    );
  });
});
