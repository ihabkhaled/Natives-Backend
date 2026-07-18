export { AuditRecorderService } from './application/audit-recorder.service';
export { IdempotencyService } from './application/idempotency.service';
export { NotificationQuietHoursService } from './application/notification-quiet-hours.service';
export { ProcessOutboxBatchUseCase } from './application/process-outbox-batch.use-case';
export { RecordDomainEventService } from './application/record-domain-event.service';
export {
  AuditOutcome,
  IdempotencyOutcome,
  NotificationCategory,
  NotificationChannel,
} from './model/platform.enums';
export type {
  AuditInput,
  DomainEventInput,
  IdempotencyDecision,
  IdempotencyLookup,
  ScalarPayload,
} from './model/platform.types';
export { PlatformModule } from './platform.module';
