import type {
  AuditOutcome,
  DeliveryStatus,
  IdempotencyOutcome,
  IdempotencyStatus,
  NotificationCategory,
  NotificationChannel,
  OutboxStatus,
} from './platform.enums';

/**
 * A single JSON scalar. Audit diffs, event payloads, and notification params are
 * restricted to flat scalar maps so redaction is total and no file bytes, nested
 * objects, or accidental PII graphs can be persisted or logged.
 */
export type JsonScalar = string | number | boolean | null;

export type ScalarPayload = Readonly<Record<string, JsonScalar>>;

// --- Audit -------------------------------------------------------------------

/** A write to be recorded in the append-only audit log (before redaction). */
export interface AuditInput {
  readonly actorUserId: string | null;
  readonly action: string;
  readonly resourceType: string;
  readonly resourceId: string | null;
  readonly teamId: string | null;
  readonly seasonId: string | null;
  readonly correlationId: string | null;
  readonly outcome: AuditOutcome;
  readonly diff: ScalarPayload;
}

/** A persisted, immutable audit entry. */
export interface AuditEntry {
  readonly id: string;
  readonly actorUserId: string | null;
  readonly action: string;
  readonly resourceType: string;
  readonly resourceId: string | null;
  readonly teamId: string | null;
  readonly seasonId: string | null;
  readonly correlationId: string | null;
  readonly outcome: AuditOutcome;
  readonly diff: ScalarPayload;
  readonly occurredAt: Date;
}

/** A fully-built audit row ready for insertion (id + time resolved). */
export interface NewAuditEntry extends AuditInput {
  readonly id: string;
  readonly occurredAt: Date;
}

// --- Domain events / outbox --------------------------------------------------

/** Caller-supplied intent to publish a versioned domain event. */
export interface DomainEventInput {
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly eventType: string;
  readonly eventVersion: number;
  readonly actorUserId: string | null;
  readonly teamId: string | null;
  readonly seasonId: string | null;
  readonly correlationId: string | null;
  readonly causationId: string | null;
  readonly payload: ScalarPayload;
}

/**
 * A versioned, immutable domain event envelope. Past-tense fact with stable
 * event/aggregate identity, actor/scope, correlation/causation for tracing, and a
 * redacted scalar payload. Persisted atomically to the outbox in the same
 * transaction as the state change it describes.
 */
export interface DomainEventEnvelope {
  readonly eventId: string;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly eventType: string;
  readonly eventVersion: number;
  readonly actorUserId: string | null;
  readonly teamId: string | null;
  readonly seasonId: string | null;
  readonly correlationId: string | null;
  readonly causationId: string | null;
  readonly payload: ScalarPayload;
  readonly occurredAt: Date;
}

/** An outbox row leased for processing (envelope + delivery bookkeeping). */
export interface LeasedEvent {
  readonly envelope: DomainEventEnvelope;
  readonly status: OutboxStatus;
  readonly attempts: number;
}

/** Aggregate counts of outbox rows by lifecycle state. */
export interface OutboxMetrics {
  readonly pending: number;
  readonly processing: number;
  readonly completed: number;
  readonly deadLettered: number;
}

/** Acknowledgement returned when a dead-lettered event is requeued for replay. */
export interface ReplayResult {
  readonly eventId: string;
  readonly requeued: boolean;
}

/** Outcome summary of one worker batch. */
export interface OutboxBatchResult {
  readonly leased: number;
  readonly completed: number;
  readonly retried: number;
  readonly deadLettered: number;
}

/** The plan a retry policy produces for a failed event. */
export interface RetryPlan {
  readonly deadLettered: boolean;
  readonly availableAt: Date;
}

/**
 * Handles a single leased domain event. Implemented inside the platform module
 * (the notification projector) and injected into the worker so the worker stays
 * transport-agnostic. Handlers must be idempotent — an event may be retried.
 */
export interface OutboxEventHandlerPort {
  handle(
    scope: TransactionScopeLike,
    event: DomainEventEnvelope,
  ): Promise<void>;
}

// --- Idempotency -------------------------------------------------------------

/** Lookup key for an idempotent operation, scoped to the acting principal. */
export interface IdempotencyLookup {
  readonly key: string;
  readonly requestHash: string;
  readonly principalUserId: string;
  readonly scopeKey: string | null;
  readonly expiresAt: Date;
  readonly now: Date;
}

/** A persisted idempotency record. */
export interface IdempotencyRecord {
  readonly id: string;
  readonly key: string;
  readonly requestHash: string;
  readonly principalUserId: string;
  readonly scopeKey: string | null;
  readonly status: IdempotencyStatus;
  readonly statusCode: number | null;
  readonly result: ScalarPayload | null;
  readonly expiresAt: Date;
  readonly createdAt: Date;
}

/** An idempotency record ready for insertion in the in-progress state. */
export interface NewIdempotencyRecord {
  readonly id: string;
  readonly key: string;
  readonly requestHash: string;
  readonly principalUserId: string;
  readonly scopeKey: string | null;
  readonly expiresAt: Date;
  readonly now: Date;
}

/** The decision the idempotency service returns to a caller starting an op. */
export interface IdempotencyDecision {
  readonly outcome: IdempotencyOutcome;
  readonly recordId: string;
  readonly statusCode: number | null;
  readonly result: ScalarPayload | null;
}

// --- Notifications -----------------------------------------------------------

/** A user-facing notification in the in-app inbox (i18n key + safe params). */
export interface Notification {
  readonly id: string;
  readonly userId: string;
  readonly teamId: string | null;
  readonly category: NotificationCategory;
  readonly eventType: string;
  readonly titleKey: string;
  readonly bodyKey: string;
  readonly params: ScalarPayload;
  readonly dedupeKey: string;
  readonly readAt: Date | null;
  readonly createdAt: Date;
}

/** A notification row ready for insertion. */
export interface NewNotification {
  readonly id: string;
  readonly userId: string;
  readonly teamId: string | null;
  readonly category: NotificationCategory;
  readonly eventType: string;
  readonly titleKey: string;
  readonly bodyKey: string;
  readonly params: ScalarPayload;
  readonly dedupeKey: string;
  readonly now: Date;
}

/** A per-user, per-category, per-channel delivery preference. */
export interface NotificationPreference {
  readonly userId: string;
  readonly category: NotificationCategory;
  readonly channel: NotificationChannel;
  readonly enabled: boolean;
}

/** A preference change requested by the owning user. */
export interface PreferenceUpdate {
  readonly category: NotificationCategory;
  readonly channel: NotificationChannel;
  readonly enabled: boolean;
}

/** A delivery attempt of a notification over a channel. */
export interface NewDelivery {
  readonly id: string;
  readonly notificationId: string;
  readonly channel: NotificationChannel;
  readonly status: DeliveryStatus;
  readonly lastError: string | null;
  readonly now: Date;
}

/** Result of asking a channel adapter to send a notification. */
export interface SendResult {
  readonly notificationId: string;
  readonly delivered: boolean;
  readonly error: string | null;
}

/**
 * A channel provider boundary. The in-app adapter is the only implementation in
 * this slice; email/push adapters bind the same port later. No vendor SDK leaks
 * past this seam.
 */
export interface NotificationSenderPort {
  readonly channel: NotificationChannel;
  send(notification: Notification): SendResult;
}

/** Notification projection returned by the API — the internal dedupe key removed. */
export interface NotificationView {
  readonly id: string;
  readonly teamId: string | null;
  readonly category: NotificationCategory;
  readonly eventType: string;
  readonly titleKey: string;
  readonly bodyKey: string;
  readonly params: ScalarPayload;
  readonly readAt: Date | null;
  readonly createdAt: Date;
}

/** Envelope for the current user's notification preferences. */
export interface PreferencesView {
  readonly items: readonly NotificationPreference[];
}

// --- Pagination --------------------------------------------------------------

export interface PageRequest {
  readonly limit: number;
  readonly offset: number;
}

export interface PagedResult<TItem> {
  readonly items: readonly TItem[];
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
}

// --- Persistence seam --------------------------------------------------------

/**
 * Structural mirror of the core `TransactionScope` so model/port types stay free
 * of a cross-layer import. Repositories receive the real scope; this shape keeps
 * the handler port vendor-free.
 */
export interface TransactionScopeLike {
  run<TRow>(
    statement: string,
    parameters?: readonly unknown[],
  ): Promise<TRow[]>;
}
