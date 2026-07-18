import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NotificationNotFoundError } from '../errors/notification-not-found.error';
import { NotificationCategory } from '../model/platform.enums';
import type { Notification } from '../model/platform.types';
import { MarkNotificationReadService } from './mark-notification-read.service';

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
  params: {},
  dedupeKey: 'member.invited:mem-1:user-1',
  readAt: NOW,
  createdAt: NOW,
};

function build() {
  const clock = { now: () => NOW, uptime: () => 0 };
  const notifications = { markRead: vi.fn() };
  const unitOfWork = {
    runInTransaction: vi.fn((op: (scope: never) => unknown) => op(SCOPE)),
  };
  const service = new MarkNotificationReadService(
    unitOfWork as never,
    clock,
    notifications as never,
  );
  return { service, notifications };
}

describe('MarkNotificationReadService', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('marks the notification read and returns a stripped view', async () => {
    harness.notifications.markRead.mockResolvedValue(NOTIFICATION);
    const view = await harness.service.markRead(ACTOR, 'n-1');
    expect(view.readAt).toEqual(NOW);
    expect(view).not.toHaveProperty('dedupeKey');
    expect(harness.notifications.markRead).toHaveBeenCalledWith(
      SCOPE,
      'user-1',
      'n-1',
      NOW,
    );
  });

  it('raises 404 when the notification is missing or not owned', async () => {
    harness.notifications.markRead.mockResolvedValue(null);
    await expect(
      harness.service.markRead(ACTOR, 'ghost'),
    ).rejects.toBeInstanceOf(NotificationNotFoundError);
  });
});
