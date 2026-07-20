import { describe, expect, it } from 'vitest';

import { FixtureScheduleError } from '../errors/fixture-schedule.error';
import {
  assertFixtureWithinWindow,
  assertRescheduleMovesFixture,
  isWithinWindow,
} from './fixture-scheduling.policy';

describe('fixture scheduling policy', () => {
  it('treats a null window bound as open', () => {
    expect(isWithinWindow('2026-05-10', null, null)).toBe(true);
    expect(isWithinWindow('2026-05-10', '2026-05-01', null)).toBe(true);
    expect(isWithinWindow('2026-05-10', null, '2026-05-31')).toBe(true);
  });

  it('accepts a day inside a closed window, inclusive of the bounds', () => {
    expect(isWithinWindow('2026-05-01', '2026-05-01', '2026-05-31')).toBe(true);
    expect(isWithinWindow('2026-05-31', '2026-05-01', '2026-05-31')).toBe(true);
    expect(isWithinWindow('2026-05-15', '2026-05-01', '2026-05-31')).toBe(true);
  });

  it('rejects a day before the start or after the end', () => {
    expect(isWithinWindow('2026-04-30', '2026-05-01', '2026-05-31')).toBe(
      false,
    );
    expect(isWithinWindow('2026-06-01', '2026-05-01', '2026-05-31')).toBe(
      false,
    );
  });

  it('asserts within the window and throws otherwise', () => {
    expect(() =>
      assertFixtureWithinWindow('2026-05-10', '2026-05-01', '2026-05-31'),
    ).not.toThrow();
    expect(() =>
      assertFixtureWithinWindow('2026-06-10', '2026-05-01', '2026-05-31'),
    ).toThrow(FixtureScheduleError);
  });

  it('rejects a reschedule that does not move the instant', () => {
    expect(() => assertRescheduleMovesFixture(1000, 2000)).not.toThrow();
    expect(() => assertRescheduleMovesFixture(1000, 1000)).toThrow(
      FixtureScheduleError,
    );
  });
});
