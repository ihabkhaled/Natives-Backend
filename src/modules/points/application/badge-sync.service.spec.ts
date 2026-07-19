import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BadgeStatus } from '../model/points.enums';
import type { BadgeDefinition, BadgeScope } from '../model/points.types';
import { BadgeSyncService } from './badge-sync.service';

const NOW = new Date('2026-02-01T00:00:00.000Z');
const SCOPE: BadgeScope = {
  teamId: 'team-1',
  membershipId: 'mem-1',
  actorUserId: 'admin',
};

function definition(id: string, threshold: number): BadgeDefinition {
  return {
    id,
    teamId: null,
    badgeKey: id,
    name: id,
    description: null,
    threshold,
    status: BadgeStatus.Active,
    icon: null,
  };
}

function build() {
  const idGenerator = { generate: vi.fn().mockReturnValue('badge-id') };
  const ledger = { totalFor: vi.fn().mockResolvedValue(150) };
  const badges = {
    listActive: vi
      .fn()
      .mockResolvedValue([definition('trophy', 100), definition('globe', 200)]),
    earnedDefinitionIds: vi.fn().mockResolvedValue([]),
    insertPlayerBadge: vi.fn().mockResolvedValue({ id: 'pb-1' }),
  };
  const events = { enqueue: vi.fn().mockResolvedValue(undefined) };
  const service = new BadgeSyncService(
    idGenerator,
    ledger as never,
    badges as never,
    events as never,
  );
  return { ledger, badges, events, service, tx: {} as never };
}

describe('BadgeSyncService', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('awards each newly crossed tier and announces it', async () => {
    await harness.service.sync(harness.tx, SCOPE, NOW);
    expect(harness.badges.insertPlayerBadge).toHaveBeenCalledTimes(1);
    expect(harness.events.enqueue).toHaveBeenCalledTimes(1);
  });

  it('does not announce a tier the member already held (idempotent insert)', async () => {
    harness.badges.insertPlayerBadge.mockResolvedValue(null);
    await harness.service.sync(harness.tx, SCOPE, NOW);
    expect(harness.events.enqueue).not.toHaveBeenCalled();
  });

  it('awards nothing when the total crosses no active tier', async () => {
    harness.ledger.totalFor.mockResolvedValue(50);
    await harness.service.sync(harness.tx, SCOPE, NOW);
    expect(harness.badges.insertPlayerBadge).not.toHaveBeenCalled();
  });
});
