import { describe, expect, it } from 'vitest';

import type { NotificationQuietHours } from '../model/platform.types';
import {
  isDeliveryAllowed,
  isWithinQuietHours,
} from './notification-quiet-hours.policy';

const QUIET_HOURS: NotificationQuietHours = {
  userId: 'user-1',
  timezone: 'Africa/Cairo',
  startsLocal: '22:00',
  endsLocal: '07:00',
  urgentCancellationOverride: true,
};

describe('notification quiet-hours policy', () => {
  it('detects an overnight quiet window in the recipient timezone', () => {
    expect(
      isWithinQuietHours(new Date('2026-07-18T21:30:00.000Z'), QUIET_HOURS),
    ).toBe(true);
    expect(
      isWithinQuietHours(new Date('2026-07-18T09:00:00.000Z'), QUIET_HOURS),
    ).toBe(false);
  });

  it('supports a same-day quiet window and disabled equal bounds', () => {
    const daytime = {
      ...QUIET_HOURS,
      startsLocal: '12:00',
      endsLocal: '14:00',
    };
    expect(
      isWithinQuietHours(new Date('2026-07-18T10:30:00.000Z'), daytime),
    ).toBe(true);
    expect(
      isWithinQuietHours(new Date('2026-07-18T10:30:00.000Z'), {
        ...daytime,
        endsLocal: '12:00',
      }),
    ).toBe(false);
  });

  it('suppresses a normal delivery and allows an urgent cancellation override', () => {
    const duringQuiet = new Date('2026-07-18T21:30:00.000Z');
    expect(isDeliveryAllowed(duringQuiet, QUIET_HOURS, false)).toBe(false);
    expect(isDeliveryAllowed(duringQuiet, QUIET_HOURS, true)).toBe(true);
    expect(
      isDeliveryAllowed(
        duringQuiet,
        {
          ...QUIET_HOURS,
          urgentCancellationOverride: false,
        },
        true,
      ),
    ).toBe(false);
    expect(
      isDeliveryAllowed(
        new Date('2026-07-18T09:00:00.000Z'),
        QUIET_HOURS,
        false,
      ),
    ).toBe(true);
  });
});
