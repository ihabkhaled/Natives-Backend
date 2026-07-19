import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { BadgeDefinitionRow, PlayerBadgeRow } from '../model/points.rows';
import type { NewPlayerBadge } from '../model/points.types';
import { BadgeRepository } from './badge.repository';

const NOW = new Date('2026-02-01T00:00:00.000Z');

function definitionRow(): BadgeDefinitionRow {
  return {
    id: 'trophy',
    team_id: null,
    badge_key: 'trophy',
    name: 'Trophy',
    description: null,
    threshold: 100,
    status: 'active',
    icon: null,
  };
}

function playerBadgeRow(): PlayerBadgeRow {
  return {
    id: 'pb-1',
    team_id: 'team-1',
    membership_id: 'mem-1',
    badge_definition_id: 'trophy',
    badge_key: 'trophy',
    threshold: 100,
    points_at_award: '150',
    awarded_by: null,
    awarded_at: NOW.toISOString(),
  };
}

function newBadge(): NewPlayerBadge {
  return {
    id: 'pb-1',
    teamId: 'team-1',
    membershipId: 'mem-1',
    badgeDefinitionId: 'trophy',
    badgeKey: 'trophy',
    threshold: 100,
    pointsAtAward: 150,
    awardedBy: null,
    now: NOW,
  };
}

function build() {
  const run = vi.fn();
  const scope = { run } as never;
  return { run, scope, repository: new BadgeRepository() };
}

describe('BadgeRepository', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('lists only active definitions for the team scope', async () => {
    harness.run.mockResolvedValueOnce([definitionRow()]);
    const definitions = await harness.repository.listActive(
      harness.scope,
      'team-1',
    );
    expect(definitions[0]?.badgeKey).toBe('trophy');
    expect(String(harness.run.mock.calls[0]?.[0])).toContain('"status" = $2');
  });

  it('lists the definition ids a member has already earned', async () => {
    harness.run.mockResolvedValueOnce([{ id: 'trophy' }, { id: 'globe' }]);
    expect(
      await harness.repository.earnedDefinitionIds(harness.scope, 'mem-1'),
    ).toEqual(['trophy', 'globe']);
  });

  it('inserts a player badge idempotently, returning null on conflict', async () => {
    harness.run.mockResolvedValueOnce([playerBadgeRow()]);
    expect(
      await harness.repository.insertPlayerBadge(harness.scope, newBadge()),
    ).not.toBeNull();
    expect(String(harness.run.mock.calls[0]?.[0])).toContain(
      'ON CONFLICT ("membership_id", "badge_definition_id") DO NOTHING',
    );
    harness.run.mockResolvedValueOnce([]);
    expect(
      await harness.repository.insertPlayerBadge(harness.scope, newBadge()),
    ).toBeNull();
  });

  it('lists a member badges', async () => {
    harness.run.mockResolvedValueOnce([playerBadgeRow()]);
    const badges = await harness.repository.listForMembership(
      harness.scope,
      'mem-1',
    );
    expect(badges[0]?.pointsAtAward).toBe(150);
  });
});
