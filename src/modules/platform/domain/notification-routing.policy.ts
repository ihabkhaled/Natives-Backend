import {
  NOTIFICATION_ROUTES,
  type NotificationRoute,
  RECIPIENT_PAYLOAD_KEY,
} from '../model/platform.constants';
import type { DomainEventEnvelope } from '../model/platform.types';

/**
 * Pure routing rules that turn a domain event into an in-app notification plan.
 * Only events present in `NOTIFICATION_ROUTES` fan out; others are traced through
 * the outbox with no user-facing notification. Recipient resolution never trusts
 * a nested graph — it reads a single optional scalar from the redacted payload,
 * falling back to the actor.
 */
export function resolveNotificationRoute(
  eventType: string,
): NotificationRoute | null {
  return NOTIFICATION_ROUTES.get(eventType) ?? null;
}

/** The user who should receive the notification, or null when none is derivable. */
export function resolveRecipient(event: DomainEventEnvelope): string | null {
  const explicit = new Map(Object.entries(event.payload)).get(
    RECIPIENT_PAYLOAD_KEY,
  );
  if (typeof explicit === 'string' && explicit.length > 0) {
    return explicit;
  }
  return event.actorUserId;
}

/** Stable per-recipient dedupe key so a retried event yields one notification. */
export function buildDedupeKey(
  eventType: string,
  aggregateId: string,
  recipientUserId: string,
): string {
  return `${eventType}:${aggregateId}:${recipientUserId}`;
}
