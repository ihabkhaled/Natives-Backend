import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MembershipStatus } from '../model/members.enums';
import type { MembershipStatusEvent } from '../model/members.types';
import { MemberHistoryService } from './member-history.service';

const SCOPE = {} as never;
const NOW = new Date('2026-06-01T00:00:00.000Z');

const EVENT: MembershipStatusEvent = {
  id: 'ev-1',
  membershipId: 'mem-1',
  fromStatus: null,
  toStatus: MembershipStatus.Invited,
  reason: null,
  actorUserId: 'admin-1',
  effectiveAt: NOW,
  occurredAt: NOW,
};

function build() {
  const unitOfWork = {
    runInTransaction: vi.fn((op: (scope: never) => unknown) => op(SCOPE)),
  };
  const lookup = { requireMembership: vi.fn().mockResolvedValue({}) };
  const events = { listByMembership: vi.fn().mockResolvedValue([EVENT]) };
  const service = new MemberHistoryService(
    unitOfWork as never,
    lookup as never,
    events as never,
  );
  return { service, lookup, events };
}

describe('MemberHistoryService', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('lists the status history after verifying the membership', async () => {
    const result = await harness.service.listHistory('team-1', 'mem-1');
    expect(result.items).toEqual([EVENT]);
    expect(harness.lookup.requireMembership).toHaveBeenCalledWith(
      SCOPE,
      'team-1',
      'mem-1',
    );
  });
});
