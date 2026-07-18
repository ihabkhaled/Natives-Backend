/**
 * Enumerated states for the platform foundation: audit outcomes, the transactional
 * outbox lifecycle, idempotency record status, notification channels/categories,
 * and delivery status. Each enum ships a `*_VALUES` tuple so migrations, DTO
 * validators, and check-constraint mirrors reference one source of truth. Values
 * are stable, lowercase, snake-safe wire strings.
 */

/** Outcome recorded on an append-only audit entry. */
export enum AuditOutcome {
  Success = 'success',
  Failure = 'failure',
  Denied = 'denied',
}

export const AUDIT_OUTCOME_VALUES: readonly AuditOutcome[] =
  Object.values(AuditOutcome);

/** Lifecycle of a transactional-outbox row from enqueue to terminal state. */
export enum OutboxStatus {
  Pending = 'pending',
  Processing = 'processing',
  Completed = 'completed',
  DeadLettered = 'dead_lettered',
}

export const OUTBOX_STATUS_VALUES: readonly OutboxStatus[] =
  Object.values(OutboxStatus);

/** Status of a stored idempotency record. */
export enum IdempotencyStatus {
  InProgress = 'in_progress',
  Completed = 'completed',
}

export const IDEMPOTENCY_STATUS_VALUES: readonly IdempotencyStatus[] =
  Object.values(IdempotencyStatus);

/**
 * Classification returned by the idempotency policy for an incoming request:
 * a brand-new key, a completed replay, or a mismatch/in-flight conflict.
 */
export enum IdempotencyOutcome {
  New = 'new',
  Replay = 'replay',
  Conflict = 'conflict',
}

/** Delivery channels for notifications. Only in-app is active in this slice. */
export enum NotificationChannel {
  InApp = 'in_app',
  Email = 'email',
  Push = 'push',
}

export const NOTIFICATION_CHANNEL_VALUES: readonly NotificationChannel[] =
  Object.values(NotificationChannel);

/** Coarse notification categories used for preferences and routing. */
export enum NotificationCategory {
  MemberLifecycle = 'member_lifecycle',
  Practice = 'practice',
  Attendance = 'attendance',
  System = 'system',
}

export const NOTIFICATION_CATEGORY_VALUES: readonly NotificationCategory[] =
  Object.values(NotificationCategory);

/** Delivery attempt status for a notification on a given channel. */
export enum DeliveryStatus {
  Pending = 'pending',
  Sent = 'sent',
  Failed = 'failed',
}

export const DELIVERY_STATUS_VALUES: readonly DeliveryStatus[] =
  Object.values(DeliveryStatus);
