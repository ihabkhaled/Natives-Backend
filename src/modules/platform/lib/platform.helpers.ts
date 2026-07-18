import {
  LIST_DEFAULT_LIMIT,
  LIST_DEFAULT_OFFSET,
  LIST_MAX_LIMIT,
  LIST_MAX_OFFSET,
} from '../model/platform.constants';
import type {
  AuditOutcome,
  IdempotencyStatus,
  NotificationCategory,
  NotificationChannel,
  OutboxStatus,
} from '../model/platform.enums';
import {
  AUDIT_OUTCOME_VALUES,
  IDEMPOTENCY_STATUS_VALUES,
  NOTIFICATION_CATEGORY_VALUES,
  NOTIFICATION_CHANNEL_VALUES,
  OUTBOX_STATUS_VALUES,
} from '../model/platform.enums';
import type { PageRequest } from '../model/platform.types';

// --- Scalar conversions ------------------------------------------------------

export function toDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

export function toNullableDate(value: string | Date | null): Date | null {
  if (value === null) {
    return null;
  }
  return value instanceof Date ? value : new Date(value);
}

/** Clamp a caller-supplied page window to safe, bounded values. */
export function resolvePage(
  limit: number | undefined,
  offset: number | undefined,
): PageRequest {
  const boundedLimit = Math.min(limit ?? LIST_DEFAULT_LIMIT, LIST_MAX_LIMIT);
  const boundedOffset = Math.min(
    offset ?? LIST_DEFAULT_OFFSET,
    LIST_MAX_OFFSET,
  );
  return {
    limit: Math.max(boundedLimit, 1),
    offset: Math.max(boundedOffset, 0),
  };
}

// --- Enum parsing ------------------------------------------------------------

function parseEnum<TValue extends string>(
  values: readonly TValue[],
  raw: string,
  label: string,
): TValue {
  const match = values.find(value => value === raw);
  if (match === undefined) {
    throw new Error(`Unrecognized ${label} value: ${raw}`);
  }
  return match;
}

export function parseAuditOutcome(raw: string): AuditOutcome {
  return parseEnum(AUDIT_OUTCOME_VALUES, raw, 'audit outcome');
}

export function parseOutboxStatus(raw: string): OutboxStatus {
  return parseEnum(OUTBOX_STATUS_VALUES, raw, 'outbox status');
}

export function parseIdempotencyStatus(raw: string): IdempotencyStatus {
  return parseEnum(IDEMPOTENCY_STATUS_VALUES, raw, 'idempotency status');
}

export function parseNotificationCategory(raw: string): NotificationCategory {
  return parseEnum(NOTIFICATION_CATEGORY_VALUES, raw, 'notification category');
}

export function parseNotificationChannel(raw: string): NotificationChannel {
  return parseEnum(NOTIFICATION_CHANNEL_VALUES, raw, 'notification channel');
}
