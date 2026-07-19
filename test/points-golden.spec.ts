import { badgesToAward } from '@modules/points/domain/badge-award.policy';
import { computeAward } from '@modules/points/domain/points-award.policy';
import {
  AwardSkipReason,
  BadgeStatus,
  PointsApproval,
} from '@modules/points/model/points.enums';
import type {
  AwardFacts,
  BadgeDefinition,
  RulePointEntry,
} from '@modules/points/model/points.types';
import { describe, expect, it } from 'vitest';

/**
 * GOLDEN points tests. Each fixture pins the rule version's per-category value,
 * the cap/cooldown facts, and the exact awarded amount or the named skip reason —
 * exercised through the real deterministic award calculator. Badge boundaries are
 * pinned at the legacy tier thresholds (>100 / >200 / >450 exact) and the disabled
 * broken #REF! tier (>649) proven never awardable. No guessed zero anywhere.
 */

// The seeded external-training candidate values (rule version 1).
const GYM: RulePointEntry = {
  activityCategory: 'gym',
  points: 2,
  dailyCap: 1,
  cooldownDays: null,
};
const THROWING: RulePointEntry = {
  activityCategory: 'throwing',
  points: 4,
  dailyCap: 1,
  cooldownDays: null,
};
const WEEKLY_QUIZ: RulePointEntry = {
  activityCategory: 'rules_quiz',
  points: 2,
  dailyCap: null,
  cooldownDays: 7,
};

const EMPTY_FACTS: AwardFacts = { sameDayCount: 0, lastAwardOn: null };

describe('golden: award per rule version', () => {
  it('awards the throwing value of 4 for a first-of-day session', () => {
    const decision = computeAward({
      entry: THROWING,
      pointsApproval: PointsApproval.Approved,
      facts: EMPTY_FACTS,
      performedOn: '2026-03-01',
    });
    expect(decision).toEqual({
      awarded: true,
      amount: 4,
      skipReason: AwardSkipReason.None,
    });
  });

  it('awards the gym value of 2', () => {
    const decision = computeAward({
      entry: GYM,
      pointsApproval: PointsApproval.Approved,
      facts: EMPTY_FACTS,
      performedOn: '2026-03-01',
    });
    expect(decision.amount).toBe(2);
  });
});

describe('golden: caps and cooldowns', () => {
  it('withholds a second same-day gym award (daily cap 1)', () => {
    const decision = computeAward({
      entry: GYM,
      pointsApproval: PointsApproval.Approved,
      facts: { sameDayCount: 1, lastAwardOn: '2026-03-01' },
      performedOn: '2026-03-01',
    });
    expect(decision.awarded).toBe(false);
    expect(decision.skipReason).toBe(AwardSkipReason.Cap);
  });

  it('withholds a rules-quiz award inside the 7-day cooldown', () => {
    const decision = computeAward({
      entry: WEEKLY_QUIZ,
      pointsApproval: PointsApproval.Approved,
      facts: { sameDayCount: 0, lastAwardOn: '2026-03-01' },
      performedOn: '2026-03-05',
    });
    expect(decision.skipReason).toBe(AwardSkipReason.Cooldown);
  });

  it('awards the rules-quiz once the 7-day cooldown has elapsed', () => {
    const decision = computeAward({
      entry: WEEKLY_QUIZ,
      pointsApproval: PointsApproval.Approved,
      facts: { sameDayCount: 0, lastAwardOn: '2026-03-01' },
      performedOn: '2026-03-08',
    });
    expect(decision.awarded).toBe(true);
    expect(decision.amount).toBe(2);
  });
});

describe('golden: badge boundaries', () => {
  const active = (badgeKey: string, threshold: number): BadgeDefinition => ({
    id: badgeKey,
    teamId: null,
    badgeKey,
    name: badgeKey,
    description: null,
    threshold,
    status: BadgeStatus.Active,
    icon: null,
  });
  const trophy = active('trophy', 100);
  const globe = active('globe', 200);
  const dragon = active('dragon', 450);
  const broken: BadgeDefinition = {
    ...active('broken', 649),
    status: BadgeStatus.Disabled,
  };
  const tiers = [trophy, globe, dragon];

  it('awards no tier at exactly 100 (strictly greater)', () => {
    expect(badgesToAward(tiers, 100, new Set())).toHaveLength(0);
  });

  it('awards the trophy at 101', () => {
    expect(badgesToAward(tiers, 101, new Set()).map(b => b.badgeKey)).toEqual([
      'trophy',
    ]);
  });

  it('awards trophy + globe crossing 200 exactly', () => {
    expect(badgesToAward(tiers, 200, new Set()).map(b => b.badgeKey)).toEqual([
      'trophy',
    ]);
    expect(badgesToAward(tiers, 201, new Set()).map(b => b.badgeKey)).toEqual([
      'trophy',
      'globe',
    ]);
  });

  it('awards all three tiers past 450', () => {
    expect(badgesToAward(tiers, 451, new Set()).map(b => b.badgeKey)).toEqual([
      'trophy',
      'globe',
      'dragon',
    ]);
  });

  it('never awards the disabled broken #REF! tier, even far past 649', () => {
    expect(
      badgesToAward([...tiers, broken], 5000, new Set()).map(b => b.badgeKey),
    ).toEqual(['trophy', 'globe', 'dragon']);
  });
});
