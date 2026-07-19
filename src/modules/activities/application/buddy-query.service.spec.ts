import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BuddyStatus } from '../model/activity.enums';
import type { ActivityBuddy } from '../model/activity.types';
import { BuddyQueryService } from './buddy-query.service';

const BUDDY: ActivityBuddy = {
  id: 'b1',
  submissionId: 's1',
  membershipId: 'm2',
  status: BuddyStatus.Pending,
  respondedAt: null,
  respondedBy: null,
  createdAt: new Date('2024-05-30T00:00:00.000Z'),
};

function build() {
  const tx = {} as never;
  const unitOfWork = {
    runInTransaction: vi.fn((op: (scope: never) => unknown) => op(tx)),
  };
  const repository = {
    listPendingForMember: vi.fn(),
    countPendingForMember: vi.fn(),
  };
  const service = new BuddyQueryService(
    unitOfWork as never,
    repository as never,
  );
  return { repository, service };
}

describe('BuddyQueryService', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('lists a member’s pending buddy credits as a bounded page', async () => {
    harness.repository.listPendingForMember.mockResolvedValue([BUDDY]);
    harness.repository.countPendingForMember.mockResolvedValue(1);
    const page = await harness.service.listPendingForMember('t1', 'u2', {
      limit: 20,
      offset: 0,
    });
    expect(page.total).toBe(1);
    expect(page.items[0]?.status).toBe(BuddyStatus.Pending);
    expect('respondedBy' in (page.items[0] ?? {})).toBe(false);
  });
});
