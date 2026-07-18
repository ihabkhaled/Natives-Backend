import {
  ID_GENERATOR_PORT,
  type IdGeneratorPort,
} from '@core/id-generator/id-generator.port';
import { Inject, Injectable } from '@nestjs/common';

import {
  buildDedupeKey,
  buildDefaultDedupeSeed,
  resolveNotificationRoute,
  resolveRecipient,
} from '../domain/notification-routing.policy';
import { NotificationRepository } from '../infrastructure/notification.repository';
import { NotificationAudienceRepository } from '../infrastructure/notification-audience.repository';
import { NotificationDeliveryRepository } from '../infrastructure/notification-delivery.repository';
import { NotificationPreferenceRepository } from '../infrastructure/notification-preference.repository';
import {
  DEDUPE_PAYLOAD_KEY,
  NOTIFICATION_AUDIENCE_MAX_RECIPIENTS,
  NOTIFICATION_AUDIENCE_PAGE_LIMIT,
  NOTIFICATION_SENDER_PORT,
  type NotificationRoute,
} from '../model/platform.constants';
import { DeliveryStatus, NotificationAudience } from '../model/platform.enums';
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
    private readonly audience: NotificationAudienceRepository,
  ) {}

  async handle(
    scope: TransactionScopeLike,
    event: DomainEventEnvelope,
  ): Promise<void> {
    const route = resolveNotificationRoute(event.eventType);
    if (route === null) {
      return;
    }
    if (route.audience === NotificationAudience.Team) {
      await this.projectTeam(scope, event, route);
      return;
    }
    const recipient = resolveRecipient(event);
    if (recipient !== null) {
      await this.projectIfEnabled(scope, event, route, recipient);
    }
  }

  private async projectTeam(
    scope: TransactionScopeLike,
    event: DomainEventEnvelope,
    route: NotificationRoute,
  ): Promise<void> {
    let after: string | null = null;
    let delivered = 0;
    while (delivered < NOTIFICATION_AUDIENCE_MAX_RECIPIENTS) {
      const users = await this.teamUsers(scope, event.teamId, after);
      await this.projectUsers(scope, event, route, users);
      delivered += users.length;
      after = users.at(-1) ?? null;
      if (users.length < NOTIFICATION_AUDIENCE_PAGE_LIMIT) {
        break;
      }
    }
  }

  private teamUsers(
    scope: TransactionScopeLike,
    teamId: string | null,
    after: string | null,
  ): Promise<readonly string[]> {
    return teamId === null
      ? Promise.resolve([])
      : this.audience.listActiveTeamUsers(scope, teamId, after);
  }

  private async projectUsers(
    scope: TransactionScopeLike,
    event: DomainEventEnvelope,
    route: NotificationRoute,
    users: readonly string[],
  ): Promise<void> {
    for (const userId of users) {
      await this.projectIfEnabled(scope, event, route, userId);
    }
  }

  private async projectIfEnabled(
    scope: TransactionScopeLike,
    event: DomainEventEnvelope,
    route: NotificationRoute,
    recipient: string,
  ): Promise<void> {
    const enabled = await this.preferences.isEnabled(
      scope,
      recipient,
      route.category,
      route.channel,
    );
    if (enabled) {
      await this.project(scope, event, route, recipient);
    }
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
      dedupeKey: buildDedupeKey(this.dedupeSeed(event), recipient),
      now: event.occurredAt,
    };
  }

  private dedupeSeed(event: DomainEventEnvelope): string {
    const requested = new Map(Object.entries(event.payload)).get(
      DEDUPE_PAYLOAD_KEY,
    );
    return typeof requested === 'string' && requested.length > 0
      ? requested
      : buildDefaultDedupeSeed(event);
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
