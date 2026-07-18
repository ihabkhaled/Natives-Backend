import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  MEMBER_INVITED_EVENT,
  PRACTICE_CANCELLED_EVENT,
} from '../model/platform.constants';
import { DeliveryStatus, NotificationCategory } from '../model/platform.enums';
import type {
  DomainEventEnvelope,
  Notification,
} from '../model/platform.types';
import { NotificationProjectionService } from './notification-projection.service';

const SCOPE = {} as never;
const NOW = new Date('2026-06-01T12:00:00.000Z');

function event(
  overrides: Partial<DomainEventEnvelope> = {},
): DomainEventEnvelope {
  return {
    eventId: 'ev-1',
    aggregateType: 'membership',
    aggregateId: 'mem-1',
    eventType: MEMBER_INVITED_EVENT,
    eventVersion: 1,
    actorUserId: 'user-1',
    teamId: 'team-1',
    seasonId: null,
    correlationId: null,
    causationId: null,
    payload: { membershipId: 'mem-1' },
    occurredAt: NOW,
    ...overrides,
  };
}

const CREATED: Notification = {
  id: 'n-1',
  userId: 'user-1',
  teamId: 'team-1',
  category: NotificationCategory.MemberLifecycle,
  eventType: MEMBER_INVITED_EVENT,
  titleKey: 'notifications.member.invited.title',
  bodyKey: 'notifications.member.invited.body',
  params: { membershipId: 'mem-1' },
  dedupeKey: 'member.invited:mem-1:2026-06-01T12:00:00.000Z:user-1',
  readAt: null,
  createdAt: NOW,
};

function build() {
  const idGenerator = { generate: vi.fn().mockReturnValue('gen') };
  const sender = {
    channel: 'in_app',
    send: vi
      .fn()
      .mockReturnValue({ notificationId: 'n-1', delivered: true, error: null }),
  };
  const notifications = { insert: vi.fn().mockResolvedValue(CREATED) };
  const preferences = { isEnabled: vi.fn().mockResolvedValue(true) };
  const deliveries = { insert: vi.fn().mockResolvedValue(undefined) };
  const audience = { listActiveTeamUsers: vi.fn().mockResolvedValue([]) };
  const service = new NotificationProjectionService(
    idGenerator,
    sender as never,
    notifications as never,
    preferences as never,
    deliveries,
    audience,
  );
  return {
    service,
    sender,
    notifications,
    preferences,
    deliveries,
    audience,
  };
}

describe('NotificationProjectionService', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('creates a notification and records a delivered attempt', async () => {
    await harness.service.handle(SCOPE, event());
    expect(harness.notifications.insert.mock.calls[0]?.[1]).toMatchObject({
      userId: 'user-1',
      dedupeKey: 'member.invited:mem-1:2026-06-01T12:00:00.000Z:user-1',
    });
    expect(harness.deliveries.insert.mock.calls[0]?.[1]).toMatchObject({
      notificationId: 'n-1',
      status: DeliveryStatus.Sent,
    });
  });

  it('ignores an unmapped event type', async () => {
    await harness.service.handle(SCOPE, event({ eventType: 'unknown.event' }));
    expect(harness.preferences.isEnabled).not.toHaveBeenCalled();
    expect(harness.notifications.insert).not.toHaveBeenCalled();
  });

  it('ignores an event with no derivable recipient', async () => {
    await harness.service.handle(SCOPE, event({ actorUserId: null }));
    expect(harness.notifications.insert).not.toHaveBeenCalled();
  });

  it('skips creation when the recipient disabled the category', async () => {
    harness.preferences.isEnabled.mockResolvedValue(false);
    await harness.service.handle(SCOPE, event());
    expect(harness.notifications.insert).not.toHaveBeenCalled();
  });

  it('records no delivery when the dedupe suppresses the insert', async () => {
    harness.notifications.insert.mockResolvedValue(null);
    await harness.service.handle(SCOPE, event());
    expect(harness.deliveries.insert).not.toHaveBeenCalled();
  });

  it('records a failed delivery when the channel rejects the send', async () => {
    harness.sender.send.mockReturnValue({
      notificationId: 'n-1',
      delivered: false,
      error: 'nope',
    });
    await harness.service.handle(SCOPE, event());
    expect(harness.deliveries.insert.mock.calls[0]?.[1]).toMatchObject({
      status: DeliveryStatus.Failed,
      lastError: 'nope',
    });
  });

  it('fans a practice cancellation out to active team users', async () => {
    harness.audience.listActiveTeamUsers
      .mockResolvedValueOnce(['member-1', 'member-2'])
      .mockResolvedValueOnce([]);
    harness.notifications.insert.mockResolvedValue(CREATED);
    await harness.service.handle(
      SCOPE,
      event({
        eventType: PRACTICE_CANCELLED_EVENT,
        actorUserId: 'coach-1',
      }),
    );
    expect(harness.notifications.insert).toHaveBeenCalledTimes(2);
    expect(
      harness.notifications.insert.mock.calls.map(call => call[1].userId),
    ).toEqual(['member-1', 'member-2']);
  });

  it('uses an explicit reminder dedupe seed', async () => {
    await harness.service.handle(
      SCOPE,
      event({
        payload: {
          membershipId: 'mem-1',
          notificationDedupeKey: 'reminder:session-1:v2',
        },
      }),
    );
    expect(harness.notifications.insert.mock.calls[0]?.[1]).toMatchObject({
      dedupeKey: 'reminder:session-1:v2:user-1',
    });
  });

  it('safely ends a team route without a team scope', async () => {
    await harness.service.handle(
      SCOPE,
      event({ eventType: PRACTICE_CANCELLED_EVENT, teamId: null }),
    );
    expect(harness.audience.listActiveTeamUsers).not.toHaveBeenCalled();
    expect(harness.notifications.insert).not.toHaveBeenCalled();
  });
});
