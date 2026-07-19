import { describe, expect, it } from 'vitest';

import { BadgeStatus } from '../model/points.enums';
import type { BadgeDefinition } from '../model/points.types';
import { badgesToAward, isCrossed } from './badge-award.policy';

function definition(overrides: Partial<BadgeDefinition> = {}): BadgeDefinition {
  return {
    id: 'trophy',
    teamId: null,
    badgeKey: 'trophy',
    name: 'Trophy',
    description: null,
    threshold: 100,
    status: BadgeStatus.Active,
    icon: null,
    ...overrides,
  };
}

const TROPHY = definition();
const GLOBE = definition({ id: 'globe', badgeKey: 'globe', threshold: 200 });
const DRAGON = definition({ id: 'dragon', badgeKey: 'dragon', threshold: 450 });

describe('badgesToAward', () => {
  it('awards every active tier strictly below the total, none already earned', () => {
    const crossed = badgesToAward([TROPHY, GLOBE, DRAGON], 700, new Set());
    expect(crossed.map(badge => badge.badgeKey)).toEqual([
      'trophy',
      'globe',
      'dragon',
    ]);
  });

  it('awards only the trophy just past its threshold', () => {
    const crossed = badgesToAward([TROPHY, GLOBE, DRAGON], 101, new Set());
    expect(crossed.map(badge => badge.badgeKey)).toEqual(['trophy']);
  });

  it('does not award at exactly the threshold (strictly greater)', () => {
    expect(badgesToAward([TROPHY], 100, new Set())).toHaveLength(0);
  });

  it('skips a tier the member already earned', () => {
    const crossed = badgesToAward([TROPHY, GLOBE], 300, new Set(['trophy']));
    expect(crossed.map(badge => badge.badgeKey)).toEqual(['globe']);
  });
});

describe('isCrossed', () => {
  it('is false for a non-active definition even far past its threshold', () => {
    const broken = definition({
      id: 'broken',
      status: BadgeStatus.Disabled,
      threshold: 649,
    });
    expect(isCrossed(broken, 5000, new Set())).toBe(false);
  });

  it('is false when already earned', () => {
    expect(isCrossed(TROPHY, 500, new Set(['trophy']))).toBe(false);
  });

  it('is true when active, unearned, and strictly past the threshold', () => {
    expect(isCrossed(TROPHY, 101, new Set())).toBe(true);
  });
});
