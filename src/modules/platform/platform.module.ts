import { ClockModule } from '@core/clock/clock.module';
import { IdGeneratorModule } from '@core/id-generator/id-generator.module';
import { Module } from '@nestjs/common';

import { InAppNotificationAdapter } from './adapters/in-app-notification.adapter';
import { AuditController } from './api/audit.controller';
import { NotificationsController } from './api/notifications.controller';
import { OutboxAdminController } from './api/outbox-admin.controller';
import { AuditQueryService } from './application/audit-query.service';
import { AuditRecorderService } from './application/audit-recorder.service';
import { IdempotencyService } from './application/idempotency.service';
import { ListNotificationsService } from './application/list-notifications.service';
import { MarkNotificationReadService } from './application/mark-notification-read.service';
import { NotificationPreferencesService } from './application/notification-preferences.service';
import { NotificationProjectionService } from './application/notification-projection.service';
import { OutboxMetricsService } from './application/outbox-metrics.service';
import { ProcessOutboxBatchUseCase } from './application/process-outbox-batch.use-case';
import { RecordDomainEventService } from './application/record-domain-event.service';
import { ReplayDeadLetterUseCase } from './application/replay-dead-letter.use-case';
import { AuditLogRepository } from './infrastructure/audit-log.repository';
import { IdempotencyRepository } from './infrastructure/idempotency.repository';
import { NotificationRepository } from './infrastructure/notification.repository';
import { NotificationDeliveryRepository } from './infrastructure/notification-delivery.repository';
import { NotificationPreferenceRepository } from './infrastructure/notification-preference.repository';
import { OutboxRepository } from './infrastructure/outbox.repository';
import {
  NOTIFICATION_SENDER_PORT,
  OUTBOX_EVENT_HANDLER_PORT,
} from './model/platform.constants';

/**
 * Platform foundation: append-only audit, versioned domain events, the
 * transactional outbox + worker, idempotency, and the in-app notification
 * inbox/preferences/delivery. Owns its persistence (raw SQL via the global
 * UnitOfWorkPort), binds the channel-sender and outbox-handler ports, and exports
 * the reusable primitives (`AuditRecorderService`, `RecordDomainEventService`,
 * `IdempotencyService`, `ProcessOutboxBatchUseCase`) other modules compose with
 * inside their own transactions. No other module imports its internals.
 */
@Module({
  imports: [ClockModule, IdGeneratorModule],
  controllers: [
    NotificationsController,
    AuditController,
    OutboxAdminController,
  ],
  providers: [
    AuditLogRepository,
    OutboxRepository,
    IdempotencyRepository,
    NotificationRepository,
    NotificationPreferenceRepository,
    NotificationDeliveryRepository,
    AuditRecorderService,
    RecordDomainEventService,
    IdempotencyService,
    AuditQueryService,
    OutboxMetricsService,
    ProcessOutboxBatchUseCase,
    ReplayDeadLetterUseCase,
    ListNotificationsService,
    MarkNotificationReadService,
    NotificationPreferencesService,
    { provide: NOTIFICATION_SENDER_PORT, useClass: InAppNotificationAdapter },
    {
      provide: OUTBOX_EVENT_HANDLER_PORT,
      useClass: NotificationProjectionService,
    },
  ],
  exports: [
    AuditRecorderService,
    RecordDomainEventService,
    IdempotencyService,
    ProcessOutboxBatchUseCase,
  ],
})
export class PlatformModule {}
