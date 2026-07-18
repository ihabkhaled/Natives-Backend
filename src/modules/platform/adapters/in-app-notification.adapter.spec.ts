import { describe, expect, it } from 'vitest';

import {
  NotificationCategory,
  NotificationChannel,
} from '../model/platform.enums';
import type { Notification } from '../model/platform.types';
import { InAppNotificationAdapter } from './in-app-notification.adapter';

const NOW = new Date('2026-06-01T12:00:00.000Z');

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
  readAt: null,
  createdAt: NOW,
};

describe('InAppNotificationAdapter', () => {
  it('is the in-app channel and reports a delivered result', () => {
    const adapter = new InAppNotificationAdapter();
    expect(adapter.channel).toBe(NotificationChannel.InApp);
    expect(adapter.send(NOTIFICATION)).toEqual({
      notificationId: 'n-1',
      delivered: true,
      error: null,
    });
  });
});
