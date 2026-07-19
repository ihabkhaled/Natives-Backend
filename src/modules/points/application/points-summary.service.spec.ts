import { describe, expect, it, vi } from 'vitest';

import { LedgerEntryType, LedgerSourceType } from '../model/points.enums';
import type { LedgerEntry, PlayerBadge } from '../model/points.types';
import { PointsSummaryService } from './points-summary.service';

const NOW = new Date('2026-02-01T00:00:00.000Z');

const ENTRY: LedgerEntry = {
  id: 'entry-1',
  teamId: 'team-1',
  seasonId: null,
  membershipId: 'mem-1',
  entryType: LedgerEntryType.Award,
  amount: 4,
  sourceType: LedgerSourceType.ActivitySubmission,
  sourceId: 'sub-1',
  ruleId: 'rule-1',
  ruleVersion: 1,
  activityCategory: 'throwing',
  reason: null,
  reasonKey: null,
  reversesEntryId: null,
  idempotencyKey: 'award:sub-1:rule-1',
  effectiveOn: '2026-01-20',
  actorUserId: 'coach-1',
  createdAt: NOW,
};

const BADGE: PlayerBadge = {
  id: 'pb-1',
  teamId: 'team-1',
  membershipId: 'mem-1',
  badgeDefinitionId: 'trophy',
  badgeKey: 'trophy',
  threshold: 100,
  pointsAtAward: 150,
  awardedBy: null,
  awardedAt: NOW,
};

describe('PointsSummaryService', () => {
  it('assembles the projected total, history views, and badges', async () => {
    const ledger = {
      totalFor: vi.fn().mockResolvedValue(4),
      listForMembership: vi.fn().mockResolvedValue([ENTRY]),
    };
    const badges = { listForMembership: vi.fn().mockResolvedValue([BADGE]) };
    const service = new PointsSummaryService(ledger as never, badges as never);
    const summary = await service.assemble({} as never, 'team-1', 'mem-1');
    expect(summary.total).toBe(4);
    expect(summary.entries[0]).not.toHaveProperty('idempotencyKey');
    expect(summary.badges[0]).toEqual({
      badgeKey: 'trophy',
      threshold: 100,
      pointsAtAward: 150,
      awardedAt: NOW,
    });
  });
});
