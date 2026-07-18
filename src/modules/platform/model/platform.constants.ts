import type { ErrorMessageKey } from '@core/errors/error.types';

import { NotificationCategory, NotificationChannel } from './platform.enums';

// --- Ports -------------------------------------------------------------------
// Channel provider seam (in-app now; email/push later) and the outbox event
// handler seam (the notification projector). Consumers depend on these symbols.
export const NOTIFICATION_SENDER_PORT = Symbol('NOTIFICATION_SENDER_PORT');
export const OUTBOX_EVENT_HANDLER_PORT = Symbol('OUTBOX_EVENT_HANDLER_PORT');

// --- Routes & OpenAPI tags ---------------------------------------------------
export const NOTIFICATIONS_ROUTE = 'notifications';
export const NOTIFICATIONS_API_TAG = 'notifications';
export const NOTIFICATION_READ_ROUTE = ':notificationId/read';
export const NOTIFICATION_PREFERENCES_ROUTE = 'preferences';

export const AUDIT_ROUTE = 'teams/:teamId/audit';
export const AUDIT_API_TAG = 'audit';

export const OUTBOX_ADMIN_ROUTE = 'admin/outbox';
export const OUTBOX_ADMIN_API_TAG = 'outbox-admin';
export const OUTBOX_METRICS_ROUTE = 'metrics';
export const OUTBOX_REPLAY_ROUTE = ':eventId/replay';

// --- Route param names -------------------------------------------------------
export const TEAM_ID_PARAM = 'teamId';
export const NOTIFICATION_ID_PARAM = 'notificationId';
export const EVENT_ID_PARAM = 'eventId';

// --- Pagination --------------------------------------------------------------
export const LIST_DEFAULT_LIMIT = 20;
export const LIST_MIN_LIMIT = 1;
export const LIST_MAX_LIMIT = 100;
export const LIST_DEFAULT_OFFSET = 0;
export const LIST_MAX_OFFSET = 100000;

// --- Field bounds ------------------------------------------------------------
export const CATEGORY_MAX_LENGTH = 64;
export const CHANNEL_MAX_LENGTH = 32;

// --- Outbox worker tuning ----------------------------------------------------
// A domain-owned dispatch policy, not environment config: bounded batch, a lease
// window that lets a stalled worker's rows recover, capped exponential backoff,
// and a hard attempt ceiling before dead-lettering.
export const OUTBOX_BATCH_LIMIT = 50;
export const OUTBOX_LEASE_MS = 30_000;
export const OUTBOX_MAX_ATTEMPTS = 5;
export const OUTBOX_BACKOFF_BASE_MS = 1_000;
export const OUTBOX_BACKOFF_CAP_MS = 300_000;

// --- Redaction ---------------------------------------------------------------
// Keys whose values must never enter an audit diff, event payload, or
// notification param. Matching is case-insensitive and substring-based so
// `passwordHash`, `refreshToken`, `phoneNumber`, etc. are all caught. File bytes
// and private notes are structurally excluded by the scalar-only payload type.
export const REDACTED_VALUE = '[redacted]';
export const REDACTION_DENY_SUBSTRINGS: readonly string[] = [
  'password',
  'token',
  'secret',
  'hash',
  'authorization',
  'cookie',
  'email',
  'phone',
  'contact',
  'nationalid',
  'national_id',
  'ssn',
  'health',
  'injury',
  'discipline',
  'note',
  'bytes',
  'content',
];

// --- Domain event types (past tense, versioned via event_version) ------------
export const MEMBER_INVITED_EVENT = 'member.invited';
export const MEMBER_TRANSITIONED_EVENT = 'member.transitioned';
export const PRACTICE_SCHEDULED_EVENT = 'practice.scheduled';

// --- Notification i18n keys --------------------------------------------------
export const NOTIF_MEMBER_INVITED_TITLE = 'notifications.member.invited.title';
export const NOTIF_MEMBER_INVITED_BODY = 'notifications.member.invited.body';
export const NOTIF_MEMBER_TRANSITIONED_TITLE =
  'notifications.member.transitioned.title';
export const NOTIF_MEMBER_TRANSITIONED_BODY =
  'notifications.member.transitioned.body';
export const NOTIF_PRACTICE_SCHEDULED_TITLE =
  'notifications.practice.scheduled.title';
export const NOTIF_PRACTICE_SCHEDULED_BODY =
  'notifications.practice.scheduled.body';

/** Payload key the projector reads to target a recipient other than the actor. */
export const RECIPIENT_PAYLOAD_KEY = 'recipientUserId';

/**
 * Routing table: which past-tense event types fan out to an in-app notification,
 * and the category + i18n keys to use. Events absent from this map are recorded
 * in the outbox and completed with no notification (audit/tracing only).
 */
export interface NotificationRoute {
  readonly category: NotificationCategory;
  readonly channel: NotificationChannel;
  readonly titleKey: string;
  readonly bodyKey: string;
}

export const NOTIFICATION_ROUTES: ReadonlyMap<string, NotificationRoute> =
  new Map([
    [
      MEMBER_INVITED_EVENT,
      {
        category: NotificationCategory.MemberLifecycle,
        channel: NotificationChannel.InApp,
        titleKey: NOTIF_MEMBER_INVITED_TITLE,
        bodyKey: NOTIF_MEMBER_INVITED_BODY,
      },
    ],
    [
      MEMBER_TRANSITIONED_EVENT,
      {
        category: NotificationCategory.MemberLifecycle,
        channel: NotificationChannel.InApp,
        titleKey: NOTIF_MEMBER_TRANSITIONED_TITLE,
        bodyKey: NOTIF_MEMBER_TRANSITIONED_BODY,
      },
    ],
    [
      PRACTICE_SCHEDULED_EVENT,
      {
        category: NotificationCategory.Practice,
        channel: NotificationChannel.InApp,
        titleKey: NOTIF_PRACTICE_SCHEDULED_TITLE,
        bodyKey: NOTIF_PRACTICE_SCHEDULED_BODY,
      },
    ],
  ]);

// --- Audit actions -----------------------------------------------------------
export const AUDIT_OUTBOX_REPLAYED_ACTION = 'outbox.replayed';
export const AUDIT_RESOURCE_OUTBOX_EVENT = 'outbox_event';

// --- Worker identity ---------------------------------------------------------
export const OUTBOX_WORKER_ID = 'outbox-worker';

// --- Static persistence column lists (fixed allow-lists, never dynamic) ------
export const AUDIT_COLUMNS = `"id", "actor_user_id", "action", "resource_type",
  "resource_id", "team_id", "season_id", "correlation_id", "outcome", "diff",
  "occurred_at"`;

export const OUTBOX_COLUMNS = `"id", "aggregate_type", "aggregate_id",
  "event_type", "event_version", "actor_user_id", "team_id", "season_id",
  "correlation_id", "causation_id", "payload", "status", "attempts",
  "occurred_at"`;

export const IDEMPOTENCY_COLUMNS = `"id", "idempotency_key", "request_hash",
  "principal_user_id", "scope_key", "status", "status_code", "result",
  "expires_at", "created_at"`;

export const NOTIFICATION_COLUMNS = `"id", "user_id", "team_id", "category",
  "event_type", "title_key", "body_key", "params", "dedupe_key", "read_at",
  "created_at"`;

export const PREFERENCE_COLUMNS = `"user_id", "category", "channel", "enabled"`;

// --- Error messages & keys ---------------------------------------------------
export const IDEMPOTENCY_CONFLICT_MESSAGE =
  'This idempotency key was already used with a different request';
export const IDEMPOTENCY_CONFLICT_MESSAGE_KEY: ErrorMessageKey =
  'errors.platform.idempotencyConflict';

export const NOTIFICATION_NOT_FOUND_MESSAGE = 'The notification was not found';
export const NOTIFICATION_NOT_FOUND_MESSAGE_KEY: ErrorMessageKey =
  'errors.platform.notificationNotFound';

export const OUTBOX_EVENT_NOT_FOUND_MESSAGE = 'The outbox event was not found';
export const OUTBOX_EVENT_NOT_FOUND_MESSAGE_KEY: ErrorMessageKey =
  'errors.platform.outboxEventNotFound';

// --- Log messages ------------------------------------------------------------
export const OUTBOX_HANDLER_FAILED_LOG = 'Outbox event handler failed';
