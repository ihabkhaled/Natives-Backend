import type { JsonScalar } from './platform.types';

/**
 * Raw persistence row shapes (snake_case) returned by the platform SQL layer.
 * Repositories map these into vendor-free domain types. jsonb columns arrive as
 * already-parsed objects from the pg driver; timestamptz columns arrive as `Date`
 * or ISO string depending on the driver path.
 */

export interface AuditEntryRow {
  readonly id: string;
  readonly actor_user_id: string | null;
  readonly action: string;
  readonly resource_type: string;
  readonly resource_id: string | null;
  readonly team_id: string | null;
  readonly season_id: string | null;
  readonly correlation_id: string | null;
  readonly outcome: string;
  readonly diff: Readonly<Record<string, JsonScalar>>;
  readonly occurred_at: string | Date;
}

export interface OutboxEventRow {
  readonly id: string;
  readonly aggregate_type: string;
  readonly aggregate_id: string;
  readonly event_type: string;
  readonly event_version: number;
  readonly actor_user_id: string | null;
  readonly team_id: string | null;
  readonly season_id: string | null;
  readonly correlation_id: string | null;
  readonly causation_id: string | null;
  readonly payload: Readonly<Record<string, JsonScalar>>;
  readonly status: string;
  readonly attempts: number;
  readonly occurred_at: string | Date;
}

export interface IdempotencyRow {
  readonly id: string;
  readonly idempotency_key: string;
  readonly request_hash: string;
  readonly principal_user_id: string;
  readonly scope_key: string | null;
  readonly status: string;
  readonly status_code: number | null;
  readonly result: Readonly<Record<string, JsonScalar>> | null;
  readonly expires_at: string | Date;
  readonly created_at: string | Date;
}

export interface NotificationRow {
  readonly id: string;
  readonly user_id: string;
  readonly team_id: string | null;
  readonly category: string;
  readonly event_type: string;
  readonly title_key: string;
  readonly body_key: string;
  readonly params: Readonly<Record<string, JsonScalar>>;
  readonly dedupe_key: string;
  readonly read_at: string | Date | null;
  readonly created_at: string | Date;
}

export interface PreferenceRow {
  readonly user_id: string;
  readonly category: string;
  readonly channel: string;
  readonly enabled: boolean;
}

export interface EnabledRow {
  readonly enabled: boolean;
}

export interface QuietHoursRow {
  readonly user_id: string;
  readonly timezone: string;
  readonly starts_local: string;
  readonly ends_local: string;
  readonly urgent_cancellation_override: boolean;
}

export interface AudienceUserRow {
  readonly user_id: string;
}

export interface IdRow {
  readonly id: string;
}

export interface CountRow {
  readonly count: number;
}

export interface StatusCountRow {
  readonly status: string;
  readonly count: number;
}
