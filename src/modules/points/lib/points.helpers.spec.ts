import { describe, expect, it } from 'vitest';

import { LIST_MAX_LIMIT } from '../model/points.constants';
import {
  LEDGER_ENTRY_TYPE_VALUES,
  LedgerEntryType,
} from '../model/points.enums';
import {
  buildAdjustmentKey,
  buildAwardKey,
  buildReversalKey,
  parseEnumValue,
  resolvePointsPage,
  toDate,
  toIsoDate,
  toNullableDate,
  toNullableNumber,
  toNumber,
  toTotal,
} from './points.helpers';

describe('resolvePointsPage', () => {
  it('applies defaults and clamps to the max limit', () => {
    expect(resolvePointsPage(undefined, undefined)).toEqual({
      limit: 20,
      offset: 0,
    });
    expect(resolvePointsPage(LIST_MAX_LIMIT + 50, 5)).toEqual({
      limit: LIST_MAX_LIMIT,
      offset: 5,
    });
  });
});

describe('scalar coercion', () => {
  it('parses dates from strings and passes Date instances through', () => {
    const date = new Date('2026-01-01T00:00:00.000Z');
    expect(toDate(date)).toBe(date);
    expect(toDate('2026-01-01T00:00:00.000Z')).toEqual(date);
    expect(toNullableDate(null)).toBeNull();
    expect(toNullableDate('2026-01-01T00:00:00.000Z')).toEqual(date);
  });

  it('parses numbers and preserves nulls', () => {
    expect(toNumber('12')).toBe(12);
    expect(toNumber(7)).toBe(7);
    expect(toNullableNumber(null)).toBeNull();
    expect(toNullableNumber('3')).toBe(3);
  });

  it('coalesces a null sum to a measured zero total', () => {
    expect(toTotal(null)).toBe(0);
    expect(toTotal('42')).toBe(42);
  });
});

describe('parseEnumValue', () => {
  it('returns a recognized value and throws on an unknown one', () => {
    expect(
      parseEnumValue(LEDGER_ENTRY_TYPE_VALUES, 'award', 'entry type'),
    ).toBe(LedgerEntryType.Award);
    expect(() =>
      parseEnumValue(LEDGER_ENTRY_TYPE_VALUES, 'nope', 'entry type'),
    ).toThrow('Unrecognized entry type: nope');
  });
});

describe('keys, dates, and rank', () => {
  it('builds distinct idempotency keys', () => {
    expect(buildAwardKey('sub', 'rule')).toBe('award:sub:rule');
    expect(buildReversalKey('entry')).toBe('reversal:entry');
    expect(buildAdjustmentKey('mem', 'op')).toBe('adjust:mem:op');
  });

  it('formats the ISO date-only prefix', () => {
    expect(toIsoDate(new Date('2026-03-04T18:00:00.000Z'))).toBe('2026-03-04');
  });
});
