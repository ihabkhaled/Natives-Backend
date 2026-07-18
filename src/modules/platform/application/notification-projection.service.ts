import {
  ID_GENERATOR_PORT,
  type IdGeneratorPort,
} from '@core/id-generator/id-generator.port';
import { Inject, Injectable } from '@nestjs/common';

import {
  buildDedupeKey,
  resolveNotificationRoute,
  resolveRecipient,
} from '../domain/notification-routing.policy';
import { NotificationRepository } from '../infrastructure/notification.repository';
import { NotificationDeliveryRepository } from '../infrastructure/notification-delivery.repository';
import { NotificationPreferenceRepository } from '../infrastructure/notification-preference.repository';
import {
  NOTIFICATION_SENDER_PORT,
  type NotificationRoute,
} from '../model/platform.constants';
import { DeliveryStatus } from '../model/platform.enums';
import type {
  DomainEventEnvelope,
  NewNotification,
  Notification,
  NotificationSenderPort,
  OutboxEventHandlerPort,
  TransactionScopeLike,
} from '../model/platform.types';

/**
 * Projects domain events into in-app notifications — the concrete outbox handler.
 * Only routed event types fan out; delivery honors the recipient's preference and
 * is dedupe-safe (a retried event yields one notification). Every notification
 * records a delivery attempt through the channel port. Idempotent by design.
 */
@Injectable()
export class NotificationProjectionService implements OutboxEventHandlerPort {
  constructor(
    @Inject(ID_GENERATOR_PORT) private readonly idGenerator: IdGeneratorPort,
    @Inject(NOTIFICATION_SENDER_PORT)
    private readonly sender: NotificationSenderPort,
    private readonly notifications: NotificationRepository,
    private readonly preferences: NotificationPreferenceRepository,
    private readonly deliveries: NotificationDeliveryRepository,
  ) {}

  async handle(
    scope: TransactionScopeLike,
    event: DomainEventEnvelope,
  ): Promise<void> {
    const route = resolveNotificationRoute(event.eventType);
    const recipient = route === null ? null : resolveRecipient(event);
    if (route === null || recipient === null) {
      return;
    }
    const enabled = await this.preferences.isEnabled(
      scope,
      recipient,
      route.category,
      route.channel,
    );
    if (!enabled) {
      return;
    }
    await this.project(scope, event, route, recipient);
  }

  private async project(
    scope: TransactionScopeLike,
    event: DomainEventEnvelope,
    route: NotificationRoute,
    recipient: string,
  ): Promise<void> {
    const created = await this.notifications.insert(
      scope,
      this.build(event, route, recipient),
    );
    if (created !== null) {
      await this.deliver(scope, created, route);
    }
  }

  private build(
    event: DomainEventEnvelope,
    route: NotificationRoute,
    recipient: string,
  ): NewNotification {
    return {
      id: this.idGenerator.generate(),
      userId: recipient,
      teamId: event.teamId,
      category: route.category,
      eventType: event.eventType,
      titleKey: route.titleKey,
      bodyKey: route.bodyKey,
      params: event.payload,
      dedupeKey: buildDedupeKey(event.eventType, event.aggregateId, recipient),
      now: event.occurredAt,
    };
  }

  private deliver(
    scope: TransactionScopeLike,
    notification: Notification,
    route: NotificationRoute,
  ): Promise<void> {
    const result = this.sender.send(notification);
    return this.deliveries.insert(scope, {
      id: this.idGenerator.generate(),
      notificationId: notification.id,
      channel: route.channel,
      status: result.delivered ? DeliveryStatus.Sent : DeliveryStatus.Failed,
      lastError: result.error,
      now: notification.createdAt,
    });
  }
}
