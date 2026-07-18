import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MembershipStatus } from '../model/members.enums';
import type { StatusEventRow } from '../model/members.rows';
import type { NewStatusEvent } from '../model/members.types';
import { StatusEventRepository } from './status-event.repository';

const NOW = new Date('2026-06-01T12:00:00.000Z');

function buildScope() {
  return { run: vi.fn() };
}

const NEW_EVENT: NewStatusEvent = {
  id: 'ev-1',
  membershipId: 'mem-1',
  fromStatus: MembershipStatus.Invited,
  toStatus: MembershipStatus.Active,
  reason: 'accepted',
  actorUserId: 'admin-1',
  effectiveAt: NOW,
  now: NOW,
};

describe('StatusEventRepository', () => {
  let repo: StatusEventRepository;
  let scope: ReturnType<typeof buildScope>;

  beforeEach(() => {
    repo = new StatusEventRepository();
    scope = buildScope();
  });

  it('appends an immutable status event', async () => {
    scope.run.mockResolvedValueOnce([]);
    await repo.append(scope as never, NEW_EVENT);
    expect(scope.run.mock.calls[0]?.[1]?.[3]).toBe('active');
  });

  it('lists events for a membership', async () => {
    const row: StatusEventRow = {
      id: 'ev-1',
      membership_id: 'mem-1',
      from_status: 'invited',
      to_status: 'active',
      reason: 'accepted',
      actor_user_id: 'admin-1',
      effective_at: NOW.toISOString(),
      occurred_at: NOW.toISOString(),
    };
    scope.run.mockResolvedValueOnce([row]);
    const events = await repo.listByMembership(scope as never, 'mem-1', 200);
    expect(events).toHaveLength(1);
    expect(events[0]?.toStatus).toBe(MembershipStatus.Active);
  });
});
