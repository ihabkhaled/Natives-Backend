import { describe, expect, it } from 'vitest';

import { SignalCode, SignalStatus } from '../model/squads.enums';
import type { EligibilitySignal } from '../model/squads.types';
import {
  parseEnumValue,
  parseNullableEnumValue,
  resolveEligibilityPage,
  resolveSquadsPage,
  summarizeEligibilitySnapshot,
  toDate,
  toNullableDate,
  toNumber,
} from './squads.helpers';

const VALUES: readonly string[] = ['a', 'b'];

describe('squads.helpers', () => {
  it('clamps list paging to defaults and the max limit', () => {
    expect(resolveSquadsPage(undefined, undefined)).toEqual({
      limit: 20,
      offset: 0,
    });
    expect(resolveSquadsPage(500, 5)).toEqual({ limit: 100, offset: 5 });
  });

  it('clamps eligibility paging to its harder bound', () => {
    expect(resolveEligibilityPage(undefined, undefined)).toEqual({
      limit: 100,
      offset: 0,
    });
    expect(resolveEligibilityPage(999, 10)).toEqual({ limit: 200, offset: 10 });
  });

  it('coerces dates and nullable dates', () => {
    const date = new Date('2026-02-01T00:00:00.000Z');
    expect(toDate(date)).toBe(date);
    expect(toDate('2026-02-01T00:00:00.000Z').getTime()).toBe(date.getTime());
    expect(toNullableDate(null)).toBeNull();
    expect(toNullableDate('2026-02-01T00:00:00.000Z')).not.toBeNull();
  });

  it('coerces numeric columns arriving as strings', () => {
    expect(toNumber(70)).toBe(70);
    expect(toNumber('70.00')).toBe(70);
  });

  it('parses closed enum values and rejects unknowns', () => {
    expect(parseEnumValue(VALUES, 'a', 'thing')).toBe('a');
    expect(() => parseEnumValue(VALUES, 'z', 'thing')).toThrow(
      'Unrecognized thing: z',
    );
    expect(parseNullableEnumValue(VALUES, null, 'thing')).toBeNull();
    expect(parseNullableEnumValue(VALUES, 'b', 'thing')).toBe('b');
  });

  it('summarizes a clear snapshot as the bare overall', () => {
    const signals: EligibilitySignal[] = [
      { code: SignalCode.ActiveStatus, status: SignalStatus.Passed },
      { code: SignalCode.Attendance, status: SignalStatus.Unknown },
    ];
    expect(summarizeEligibilitySnapshot(SignalStatus.Passed, signals)).toBe(
      'passed',
    );
  });

  it('summarizes a flagged snapshot with the flagged signal codes', () => {
    const signals: EligibilitySignal[] = [
      { code: SignalCode.ActiveStatus, status: SignalStatus.Failed },
      { code: SignalCode.Attendance, status: SignalStatus.Warning },
      { code: SignalCode.Jersey, status: SignalStatus.Passed },
    ];
    expect(summarizeEligibilitySnapshot(SignalStatus.Overridden, signals)).toBe(
      'overridden:active_status,attendance',
    );
  });
});
