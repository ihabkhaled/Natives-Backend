import { describe, expect, it } from 'vitest';

import { AwardSkipReason, PointsApproval } from '../model/points.enums';
import type { AwardFacts, RulePointEntry } from '../model/points.types';
import {
  computeAward,
  daysBetween,
  resolvePointEntry,
} from './points-award.policy';

function entry(overrides: Partial<RulePointEntry> = {}): RulePointEntry {
  return {
    activityCategory: 'gym',
    points: 2,
    dailyCap: null,
    cooldownDays: null,
    ...overrides,
  };
}

const NO_FACTS: AwardFacts = { sameDayCount: 0, lastAwardOn: null };

describe('computeAward', () => {
  it('awards the entry value when nothing blocks it', () => {
    const decision = computeAward({
      entry: entry(),
      pointsApproval: PointsApproval.Approved,
      facts: NO_FACTS,
      performedOn: '2026-01-10',
    });
    expect(decision).toEqual({
      awarded: true,
      amount: 2,
      skipReason: AwardSkipReason.None,
    });
  });

  it('skips when the rule has no entry for the category', () => {
    const decision = computeAward({
      entry: null,
      pointsApproval: PointsApproval.Approved,
      facts: NO_FACTS,
      performedOn: '2026-01-10',
    });
    expect(decision.awarded).toBe(false);
    expect(decision.skipReason).toBe(AwardSkipReason.NoRuleEntry);
    expect(decision.amount).toBe(0);
  });

  it('skips a pending/unapproved activity value (null-not-zero)', () => {
    const decision = computeAward({
      entry: entry(),
      pointsApproval: PointsApproval.Pending,
      facts: NO_FACTS,
      performedOn: '2026-01-10',
    });
    expect(decision.skipReason).toBe(AwardSkipReason.PendingApproval);
  });

  it('skips a null point value', () => {
    const decision = computeAward({
      entry: entry({ points: null }),
      pointsApproval: PointsApproval.Approved,
      facts: NO_FACTS,
      performedOn: '2026-01-10',
    });
    expect(decision.skipReason).toBe(AwardSkipReason.NoValue);
  });

  it('skips when the per-day cap is reached', () => {
    const decision = computeAward({
      entry: entry({ dailyCap: 1 }),
      pointsApproval: PointsApproval.Approved,
      facts: { sameDayCount: 1, lastAwardOn: null },
      performedOn: '2026-01-10',
    });
    expect(decision.skipReason).toBe(AwardSkipReason.Cap);
  });

  it('awards under the cap when the day has room', () => {
    const decision = computeAward({
      entry: entry({ dailyCap: 2 }),
      pointsApproval: PointsApproval.Approved,
      facts: { sameDayCount: 1, lastAwardOn: null },
      performedOn: '2026-01-10',
    });
    expect(decision.awarded).toBe(true);
  });

  it('skips inside the cooldown window', () => {
    const decision = computeAward({
      entry: entry({ cooldownDays: 3 }),
      pointsApproval: PointsApproval.Approved,
      facts: { sameDayCount: 0, lastAwardOn: '2026-01-08' },
      performedOn: '2026-01-10',
    });
    expect(decision.skipReason).toBe(AwardSkipReason.Cooldown);
  });

  it('awards once the cooldown window has fully elapsed', () => {
    const decision = computeAward({
      entry: entry({ cooldownDays: 3 }),
      pointsApproval: PointsApproval.Approved,
      facts: { sameDayCount: 0, lastAwardOn: '2026-01-07' },
      performedOn: '2026-01-10',
    });
    expect(decision.awarded).toBe(true);
  });

  it('does not apply a cooldown when there is no prior award', () => {
    const decision = computeAward({
      entry: entry({ cooldownDays: 30 }),
      pointsApproval: PointsApproval.Approved,
      facts: { sameDayCount: 0, lastAwardOn: null },
      performedOn: '2026-01-10',
    });
    expect(decision.awarded).toBe(true);
  });
});

describe('resolvePointEntry', () => {
  it('finds the entry for a category', () => {
    const entries = [entry({ activityCategory: 'running' }), entry()];
    expect(resolvePointEntry(entries, 'gym')?.activityCategory).toBe('gym');
  });

  it('returns null when the category is absent', () => {
    expect(resolvePointEntry([entry()], 'throwing')).toBeNull();
  });
});

describe('daysBetween', () => {
  it('counts whole days regardless of order', () => {
    expect(daysBetween('2026-01-01', '2026-01-04')).toBe(3);
    expect(daysBetween('2026-01-04', '2026-01-01')).toBe(3);
    expect(daysBetween('2026-01-01', '2026-01-01')).toBe(0);
  });
});
