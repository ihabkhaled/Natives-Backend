import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BuddyStatus } from '../model/activity.enums';
import type { ActivityBuddyRow } from '../model/activity.rows';
import type {
  BuddyResponseUpdate,
  NewActivityBuddy,
} from '../model/activity.types';
import { ActivityBuddyRepository } from './activity-buddy.repository';

const NOW = new Date('2024-06-01T00:00:00.000Z');

const NEW_BUDDY: NewActivityBuddy = {
  id: 'b1',
  submissionId: 's1',
  membershipId: 'm2',
  status: BuddyStatus.Pending,
  now: NOW,
};

function row(overrides: Partial<ActivityBuddyRow> = {}): ActivityBuddyRow {
  return {
    id: 'b1',
    submission_id: 's1',
    membership_id: 'm2',
    status: 'pending',
    responded_at: null,
    responded_by: null,
    created_at: '2024-06-01T00:00:00.000Z',
    ...overrides,
  };
}

function build() {
  const scope = { run: vi.fn().mockResolvedValue([]) };
  return { scope, repository: new ActivityBuddyRepository() };
}

describe('ActivityBuddyRepository', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('skips the write when there are no buddies', async () => {
    await harness.repository.insertMany(harness.scope as never, []);
    expect(harness.scope.run).not.toHaveBeenCalled();
  });

  it('inserts buddies via a jsonb recordset', async () => {
    await harness.repository.insertMany(harness.scope as never, [NEW_BUDDY]);
    const payload = JSON.parse(
      String(harness.scope.run.mock.calls[0]?.[1]?.[0]),
    );
    expect(payload[0]).toMatchObject({
      id: 'b1',
      submission_id: 's1',
      membership_id: 'm2',
      status: 'pending',
    });
  });

  it('lists a submission’s buddies', async () => {
    harness.scope.run.mockResolvedValueOnce([row()]);
    const buddies = await harness.repository.listForSubmission(
      harness.scope as never,
      's1',
    );
    expect(buddies[0]?.status).toBe(BuddyStatus.Pending);
  });

  it('groups buddies by submission, empty for no ids', async () => {
    await expect(
      harness.repository.buddiesBySubmission(harness.scope as never, []),
    ).resolves.toEqual(new Map());

    harness.scope.run.mockResolvedValueOnce([
      row({ id: 'b1', submission_id: 's1' }),
      row({ id: 'b2', submission_id: 's1' }),
    ]);
    const grouped = await harness.repository.buddiesBySubmission(
      harness.scope as never,
      ['s1'],
    );
    expect(grouped.get('s1')).toHaveLength(2);
  });

  it('finds an owned buddy credit for response or returns null', async () => {
    harness.scope.run.mockResolvedValueOnce([row()]);
    await expect(
      harness.repository.findOwnedForResponse(
        harness.scope as never,
        't1',
        'b1',
        'u2',
      ),
    ).resolves.toMatchObject({ id: 'b1' });
    expect(harness.scope.run.mock.calls[0]?.[1]).toEqual(['b1', 'u2', 't1']);

    harness.scope.run.mockResolvedValueOnce([]);
    await expect(
      harness.repository.findOwnedForResponse(
        harness.scope as never,
        't1',
        'bx',
        'u2',
      ),
    ).resolves.toBeNull();
  });

  it('updates a pending buddy status or returns null on a race', async () => {
    const update: BuddyResponseUpdate = {
      id: 'b1',
      toStatus: BuddyStatus.Confirmed,
      actorUserId: 'u2',
      now: NOW,
    };
    harness.scope.run.mockResolvedValueOnce([
      row({ status: 'confirmed', responded_by: 'u2' }),
    ]);
    await expect(
      harness.repository.updateStatus(harness.scope as never, update),
    ).resolves.toMatchObject({ status: BuddyStatus.Confirmed });
    expect(String(harness.scope.run.mock.calls[0]?.[0])).toContain(
      `"status" = 'pending'`,
    );

    harness.scope.run.mockResolvedValueOnce([]);
    await expect(
      harness.repository.updateStatus(harness.scope as never, update),
    ).resolves.toBeNull();
  });

  it('lists and counts pending buddy credits for a member', async () => {
    harness.scope.run.mockResolvedValueOnce([row()]);
    await expect(
      harness.repository.listPendingForMember(
        harness.scope as never,
        't1',
        'u2',
        { limit: 20, offset: 0 },
      ),
    ).resolves.toHaveLength(1);

    harness.scope.run.mockResolvedValueOnce([{ count: 5 }]);
    await expect(
      harness.repository.countPendingForMember(
        harness.scope as never,
        't1',
        'u2',
      ),
    ).resolves.toBe(5);

    harness.scope.run.mockResolvedValueOnce([]);
    await expect(
      harness.repository.countPendingForMember(
        harness.scope as never,
        't1',
        'u2',
      ),
    ).resolves.toBe(0);
  });
});
