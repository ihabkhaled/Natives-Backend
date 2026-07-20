import { describe, expect, it } from 'vitest';

import { ROSTER_STATUS_VALUES, RosterStatus } from '../model/rosters.enums';
import {
  asArray,
  asFields,
  parseEnumValue,
  parseNullableEnumValue,
  readBoolean,
  readNullableNumber,
  readNullableString,
  readString,
  resolveEntriesPage,
  resolveRostersPage,
  toDate,
  toNullableDate,
  toNullableNumber,
  toNumber,
} from './rosters.helpers';

describe('rosters.helpers', () => {
  it('clamps roster paging to the bounded window and applies defaults', () => {
    expect(resolveRostersPage(undefined, undefined)).toEqual({
      limit: 20,
      offset: 0,
    });
    expect(resolveRostersPage(500, 10)).toEqual({ limit: 100, offset: 10 });
    expect(resolveRostersPage(5, 0)).toEqual({ limit: 5, offset: 0 });
  });

  it('clamps entry paging to its larger bounded window', () => {
    expect(resolveEntriesPage(undefined, undefined)).toEqual({
      limit: 100,
      offset: 0,
    });
    expect(resolveEntriesPage(9999, 3)).toEqual({ limit: 200, offset: 3 });
  });

  it('coerces driver dates and numbers, preserving null as "not recorded"', () => {
    const instant = new Date('2026-03-01T10:00:00.000Z');
    expect(toDate(instant)).toBe(instant);
    expect(toDate('2026-03-01T10:00:00.000Z').toISOString()).toBe(
      instant.toISOString(),
    );
    expect(toNullableDate(null)).toBeNull();
    expect(toNullableDate(instant)).toBe(instant);
    expect(toNumber(7)).toBe(7);
    expect(toNumber('7')).toBe(7);
    expect(toNullableNumber(null)).toBeNull();
    expect(toNullableNumber('0')).toBe(0);
  });

  it('parses a raw enum value against the closed set and rejects the rest', () => {
    expect(parseEnumValue(ROSTER_STATUS_VALUES, 'locked', 'status')).toBe(
      RosterStatus.Locked,
    );
    expect(() =>
      parseEnumValue(ROSTER_STATUS_VALUES, 'frozen', 'status'),
    ).toThrow('Unrecognized status: frozen');
    expect(
      parseNullableEnumValue(ROSTER_STATUS_VALUES, null, 'status'),
    ).toBeNull();
    expect(
      parseNullableEnumValue(ROSTER_STATUS_VALUES, 'draft', 'status'),
    ).toBe(RosterStatus.Draft);
  });

  it('reads typed fields out of an untyped jsonb element', () => {
    const fields = asFields({
      membershipId: 'member-1',
      jerseyNumber: 7,
      availability: null,
      constraintOverridden: true,
    });
    expect(readString(fields, 'membershipId', 'membership id')).toBe(
      'member-1',
    );
    expect(readNullableNumber(fields, 'jerseyNumber')).toBe(7);
    expect(readNullableNumber(fields, 'missing')).toBeNull();
    expect(readNullableString(fields, 'availability')).toBeNull();
    expect(readNullableString(fields, 'membershipId')).toBe('member-1');
    expect(readBoolean(fields, 'constraintOverridden')).toBe(true);
    expect(readBoolean(fields, 'missing')).toBe(false);
  });

  it('rejects a jsonb element that is not a plain object', () => {
    expect(() =>
      readString(asFields({}), 'membershipId', 'membership id'),
    ).toThrow('Unrecognized membership id');
    expect(asFields({ a: 1 }).get('a')).toBe(1);
    for (const invalid of [null, 'text', [1]]) {
      expect(() => asFields(invalid)).toThrow('Unrecognized roster snapshot');
    }
  });

  it('rejects a jsonb payload that is not an array', () => {
    expect(asArray([1, 2])).toEqual([1, 2]);
    expect(() => asArray({})).toThrow('Unrecognized roster snapshot payload');
  });
});
