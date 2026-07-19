import { describe, expect, it } from 'vitest';

import { AbuseSignal } from '../model/activity.enums';
import type { AbuseSignalFacts } from '../model/activity.types';
import { daysBetween, detectAbuseSignals } from './activity-abuse.policy';

const CLEAN: AbuseSignalFacts = {
  performedOn: '2024-06-01',
  today: '2024-06-02',
  durationMinutes: 60,
  sameDayLiveCount: 0,
  windowLiveCount: 3,
  maxBuddyRepeatCount: 1,
};

describe('activity-abuse.policy', () => {
  it('computes whole-day distances in both directions', () => {
    expect(daysBetween('2024-06-01', '2024-06-02')).toBe(1);
    expect(daysBetween('2024-06-01', '2024-06-01')).toBe(0);
    expect(daysBetween('2024-06-10', '2024-06-01')).toBe(-9);
  });

  it('raises no signals for a clean claim', () => {
    expect(detectAbuseSignals(CLEAN)).toEqual([]);
  });

  it('flags a same-day duplicate', () => {
    expect(detectAbuseSignals({ ...CLEAN, sameDayLiveCount: 1 })).toContain(
      AbuseSignal.DuplicateDay,
    );
  });

  it('flags unusual recent volume only above the threshold', () => {
    expect(detectAbuseSignals({ ...CLEAN, windowLiveCount: 14 })).toEqual([]);
    expect(detectAbuseSignals({ ...CLEAN, windowLiveCount: 15 })).toContain(
      AbuseSignal.UnusualVolume,
    );
  });

  it('flags extreme backdating only beyond the threshold', () => {
    expect(
      detectAbuseSignals({
        ...CLEAN,
        performedOn: '2024-04-03',
        today: '2024-06-02',
      }),
    ).toEqual([]);
    expect(
      detectAbuseSignals({
        ...CLEAN,
        performedOn: '2024-01-01',
        today: '2024-06-02',
      }),
    ).toContain(AbuseSignal.ExtremeBackdating);
  });

  it('flags an implausible duration but treats null-not-zero as unknown', () => {
    expect(detectAbuseSignals({ ...CLEAN, durationMinutes: null })).toEqual([]);
    expect(detectAbuseSignals({ ...CLEAN, durationMinutes: 600 })).toEqual([]);
    expect(detectAbuseSignals({ ...CLEAN, durationMinutes: 601 })).toContain(
      AbuseSignal.ImplausibleDuration,
    );
  });

  it('flags a repeated buddy pairing only above the threshold', () => {
    expect(detectAbuseSignals({ ...CLEAN, maxBuddyRepeatCount: 5 })).toEqual(
      [],
    );
    expect(detectAbuseSignals({ ...CLEAN, maxBuddyRepeatCount: 6 })).toContain(
      AbuseSignal.RepeatedBuddy,
    );
  });

  it('accumulates multiple signals deterministically in policy order', () => {
    const signals = detectAbuseSignals({
      performedOn: '2024-01-01',
      today: '2024-06-02',
      durationMinutes: 900,
      sameDayLiveCount: 2,
      windowLiveCount: 20,
      maxBuddyRepeatCount: 9,
    });
    expect(signals).toEqual([
      AbuseSignal.DuplicateDay,
      AbuseSignal.UnusualVolume,
      AbuseSignal.ExtremeBackdating,
      AbuseSignal.ImplausibleDuration,
      AbuseSignal.RepeatedBuddy,
    ]);
  });
});
