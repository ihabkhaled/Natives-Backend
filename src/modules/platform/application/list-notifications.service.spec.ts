import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NotificationCategory } from '../model/platform.enums';
import type { Notification } from '../model/platform.types';
import { ListNotificationsService } from './list-notifications.service';

const SCOPE = {} as never;
const NOW = new Date('2026-06-01T12:00:00.000Z');
const ACTOR = { userId: 'user-1', email: 'u@example.test', roles: [] };

const NOTIFICATION: Notification = {
  id: 'n-1',
  userId: 'user-1',
  teamId: 'team-1',
  category: NotificationCategory.MemberLifecycle,
  eventType: 'member.invited',
  titleKey: 'notifications.member.invited.title',
  bodyKey: 'notifications.member.invited.body',
  params: { membershipId: 'mem-1' },
  dedupeKey: 'member.invited:mem-1:user-1',
  readAt: null,
  createdAt: NOW,
};

function build() {
  const notifications = {
    listForUser: vi.fn().mockResolvedValue({
      items: [NOTIFICATION],
      total: 1,
      limit: 20,
      offset: 0,
    }),
  };
  const unitOfWork = {
    runInTransaction: vi.fn((op: (scope: never) => unknown) => op(SCOPE)),
  };
  const service = new ListNotificationsService(
    unitOfWork as never,
    notifications as never,
  );
  return { service, notifications };
}

describe('ListNotificationsService', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('lists the actor own inbox and strips the dedupe key', async () => {
    const result = await harness.service.list(ACTOR, { limit: 20, offset: 0 });
    expect(harness.notifications.listForUser).toHaveBeenCalledWith(
      SCOPE,
      'user-1',
      { limit: 20, offset: 0 },
    );
    expect(result.total).toBe(1);
    expect(result.items[0]).not.toHaveProperty('dedupeKey');
    expect(result.items[0]?.eventType).toBe('member.invited');
  });
});
