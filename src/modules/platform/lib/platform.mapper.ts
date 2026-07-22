import {
  FAILURE_CODE_HANDLER_FAILED,
  FAILURE_CODE_UNKNOWN,
} from '../model/platform.constants';
import { OutboxStatus } from '../model/platform.enums';
import type {
  AuditEntryRow,
  DeadLetterRow,
  IdempotencyRow,
  JobHeartbeatRow,
  NotificationRow,
  OutboxEventRow,
  PreferenceRow,
  StatusCountRow,
} from '../model/platform.rows';
import type {
  AuditEntry,
  DeadLetter,
  DomainEventEnvelope,
  IdempotencyRecord,
  JobHeartbeat,
  LeasedEvent,
  Notification,
  NotificationPreference,
  NotificationView,
  OutboxMetrics,
} from '../model/platform.types';
import {
  parseAuditOutcome,
  parseIdempotencyStatus,
  parseJobOutcome,
  parseNotificationCategory,
  parseNotificationChannel,
  parseOutboxStatus,
  toDate,
  toNullableDate,
} from './platform.helpers';

// --- Row → domain mappers ----------------------------------------------------

export function toAuditEntry(row: AuditEntryRow): AuditEntry {
  return {
    id: row.id,
    actorUserId: row.actor_user_id,
    action: row.action,
    resourceType: row.resource_type,
    resourceId: row.resource_id,
    teamId: row.team_id,
    seasonId: row.season_id,
    correlationId: row.correlation_id,
    outcome: parseAuditOutcome(row.outcome),
    diff: row.diff,
    occurredAt: toDate(row.occurred_at),
  };
}

export function toEventEnvelope(row: OutboxEventRow): DomainEventEnvelope {
  return {
    eventId: row.id,
    aggregateType: row.aggregate_type,
    aggregateId: row.aggregate_id,
    eventType: row.event_type,
    eventVersion: row.event_version,
    actorUserId: row.actor_user_id,
    teamId: row.team_id,
    seasonId: row.season_id,
    correlationId: row.correlation_id,
    causationId: row.causation_id,
    payload: row.payload,
    occurredAt: toDate(row.occurred_at),
  };
}

export function toLeasedEvent(row: OutboxEventRow): LeasedEvent {
  return {
    envelope: toEventEnvelope(row),
    status: parseOutboxStatus(row.status),
    attempts: row.attempts,
  };
}

export function toIdempotencyRecord(row: IdempotencyRow): IdempotencyRecord {
  return {
    id: row.id,
    key: row.idempotency_key,
    requestHash: row.request_hash,
    principalUserId: row.principal_user_id,
    scopeKey: row.scope_key,
    status: parseIdempotencyStatus(row.status),
    statusCode: row.status_code,
    result: row.result,
    expiresAt: toDate(row.expires_at),
    createdAt: toDate(row.created_at),
  };
}

export function toNotification(row: NotificationRow): Notification {
  return {
    id: row.id,
    userId: row.user_id,
    teamId: row.team_id,
    category: parseNotificationCategory(row.category),
    eventType: row.event_type,
    titleKey: row.title_key,
    bodyKey: row.body_key,
    params: row.params,
    dedupeKey: row.dedupe_key,
    readAt: toNullableDate(row.read_at),
    createdAt: toDate(row.created_at),
  };
}

export function toPreference(row: PreferenceRow): NotificationPreference {
  return {
    userId: row.user_id,
    category: parseNotificationCategory(row.category),
    channel: parseNotificationChannel(row.channel),
    enabled: row.enabled,
  };
}

/**
 * Reduce a stored `last_error` to a STABLE failure classification. Today a
 * single handler seam exists, so any recorded error is `handler_failed`; a row
 * with no recorded error classifies as `unknown`. The raw text never crosses
 * this boundary.
 */
export function toFailureCode(lastError: string | null): string {
  return lastError === null
    ? FAILURE_CODE_UNKNOWN
    : FAILURE_CODE_HANDLER_FAILED;
}

export function toDeadLetter(row: DeadLetterRow): DeadLetter {
  return {
    eventId: row.id,
    eventType: row.event_type,
    attempts: row.attempts,
    failedAt: toDate(row.dead_lettered_at),
    failureCode: toFailureCode(row.last_error),
  };
}

export function toJobHeartbeat(row: JobHeartbeatRow): JobHeartbeat {
  return {
    jobKey: row.job_key,
    lastRunAt: toDate(row.last_run_at),
    lastOutcome: parseJobOutcome(row.last_outcome),
    failureCount: row.failure_count,
  };
}

// --- Domain → response projections -------------------------------------------

/** Strip the internal dedupe key from a notification for the API surface. */
export function toNotificationView(
  notification: Notification,
): NotificationView {
  return {
    id: notification.id,
    teamId: notification.teamId,
    category: notification.category,
    eventType: notification.eventType,
    titleKey: notification.titleKey,
    bodyKey: notification.bodyKey,
    params: notification.params,
    readAt: notification.readAt,
    createdAt: notification.createdAt,
  };
}

// --- Aggregation -------------------------------------------------------------

/** Fold `GROUP BY status` counts into a dense metrics object (missing => 0). */
export function toOutboxMetrics(
  rows: readonly StatusCountRow[],
): OutboxMetrics {
  const byStatus = new Map(rows.map(row => [row.status, row.count]));
  return {
    pending: byStatus.get(OutboxStatus.Pending) ?? 0,
    processing: byStatus.get(OutboxStatus.Processing) ?? 0,
    completed: byStatus.get(OutboxStatus.Completed) ?? 0,
    deadLettered: byStatus.get(OutboxStatus.DeadLettered) ?? 0,
  };
}
