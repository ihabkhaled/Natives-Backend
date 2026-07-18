import { describe, expect, it } from 'vitest';

import {
  MEMBER_INVITED_EVENT,
  RECIPIENT_PAYLOAD_KEY,
} from '../model/platform.constants';
import { NotificationCategory } from '../model/platform.enums';
import type { DomainEventEnvelope } from '../model/platform.types';
import {
  buildDedupeKey,
  resolveNotificationRoute,
  resolveRecipient,
} from './notification-routing.policy';

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
    actorUserId: 'actor-1',
    teamId: 'team-1',
    seasonId: null,
    correlationId: null,
    causationId: null,
    payload: {},
    occurredAt: NOW,
    ...overrides,
  };
}

describe('notification-routing.policy', () => {
  describe('resolveNotificationRoute', () => {
    it('maps a known event type to its category', () => {
      const route = resolveNotificationRoute(MEMBER_INVITED_EVENT);
      expect(route?.category).toBe(NotificationCategory.MemberLifecycle);
    });

    it('returns null for an unmapped event type', () => {
      expect(resolveNotificationRoute('unknown.event')).toBeNull();
    });
  });

  describe('resolveRecipient', () => {
    it('prefers an explicit recipient in the payload', () => {
      const resolved = resolveRecipient(
        event({ payload: { [RECIPIENT_PAYLOAD_KEY]: 'target-1' } }),
      );
      expect(resolved).toBe('target-1');
    });

    it('falls back to the actor when no recipient is in the payload', () => {
      expect(resolveRecipient(event())).toBe('actor-1');
    });

    it('ignores a blank recipient and falls back to the actor', () => {
      expect(
        resolveRecipient(event({ payload: { [RECIPIENT_PAYLOAD_KEY]: '' } })),
      ).toBe('actor-1');
    });

    it('is null when neither a payload recipient nor an actor exists', () => {
      expect(resolveRecipient(event({ actorUserId: null }))).toBeNull();
    });
  });

  describe('buildDedupeKey', () => {
    it('composes a stable per-recipient key', () => {
      expect(buildDedupeKey('member.invited', 'mem-1', 'user-1')).toBe(
        'member.invited:mem-1:user-1',
      );
    });
  });
});
