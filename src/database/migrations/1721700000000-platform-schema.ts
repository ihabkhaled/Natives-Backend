import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Platform-foundation schema: append-only audit, the transactional outbox,
 * idempotency records, and the in-app notification inbox/preferences/deliveries.
 *
 *   - audit_log               append-only; actor, action, resource, team/season
 *                             scope, correlation, outcome, and a redacted jsonb
 *                             diff. Refs use ON DELETE SET NULL so evidence
 *                             survives entity removal. Never updated or deleted.
 *   - outbox_events           versioned domain-event envelopes persisted atomically
 *                             with the state change. Decoupled from all aggregate
 *                             tables (no FKs); lease/backoff/dead-letter columns
 *                             drive the worker; a partial index serves the poller.
 *   - idempotency_records     key + request hash + principal/scope + result/status
 *                             + expiry; a unique (key, principal) index rejects a
 *                             concurrent first-writer and detects replays.
 *   - notifications           in-app inbox; a unique dedupe_key makes a retried
 *                             event yield one notification. i18n keys + scalar
 *                             params only (no rendered PII text).
 *   - notification_preferences per user/category/channel toggle (absence = enabled).
 *   - notification_deliveries append-only per-channel delivery attempts.
 *
 * Conventions (docs/database.md): UUID PKs via pgcrypto gen_random_uuid(),
 * timestamptz in UTC, snake_case, check constraints mirroring the enums, bounded
 * indexes. Fully reversible: down drops exactly what up created, in dependency
 * order.
 */
export class PlatformSchema1721700000000 implements MigrationInterface {
  name = 'PlatformSchema1721700000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await this.createAuditLog(queryRunner);
    await this.createOutboxEvents(queryRunner);
    await this.createIdempotencyRecords(queryRunner);
    await this.createNotifications(queryRunner);
    await this.createNotificationPreferences(queryRunner);
    await this.createNotificationDeliveries(queryRunner);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "notification_deliveries"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "notification_preferences"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "notifications"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "idempotency_records"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "outbox_events"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "audit_log"`);
  }

  private async createAuditLog(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "audit_log" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "actor_user_id" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "action" text NOT NULL,
        "resource_type" text NOT NULL,
        "resource_id" text,
        "team_id" uuid REFERENCES "teams" ("id") ON DELETE SET NULL,
        "season_id" uuid REFERENCES "seasons" ("id") ON DELETE SET NULL,
        "correlation_id" text,
        "outcome" text NOT NULL,
        "diff" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "occurred_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "ck_audit_outcome" CHECK ("outcome" IN
          ('success', 'failure', 'denied'))
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_audit_team_time"
         ON "audit_log" ("team_id", "occurred_at" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_audit_actor" ON "audit_log" ("actor_user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_audit_resource"
         ON "audit_log" ("resource_type", "resource_id")`,
    );
  }

  private async createOutboxEvents(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "outbox_events" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "aggregate_type" text NOT NULL,
        "aggregate_id" text NOT NULL,
        "event_type" text NOT NULL,
        "event_version" integer NOT NULL,
        "actor_user_id" uuid,
        "team_id" uuid,
        "season_id" uuid,
        "correlation_id" text,
        "causation_id" text,
        "payload" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "status" text NOT NULL DEFAULT 'pending',
        "attempts" integer NOT NULL DEFAULT 0,
        "available_at" timestamptz NOT NULL DEFAULT now(),
        "leased_until" timestamptz,
        "leased_by" text,
        "last_error" text,
        "occurred_at" timestamptz NOT NULL DEFAULT now(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "completed_at" timestamptz,
        CONSTRAINT "ck_outbox_status" CHECK ("status" IN
          ('pending', 'processing', 'completed', 'dead_lettered')),
        CONSTRAINT "ck_outbox_event_version" CHECK ("event_version" >= 1)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_outbox_due" ON "outbox_events" ("available_at")
        WHERE "status" = 'pending'`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_outbox_lease" ON "outbox_events" ("leased_until")
        WHERE "status" = 'processing'`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_outbox_status" ON "outbox_events" ("status")`,
    );
  }

  private async createIdempotencyRecords(
    queryRunner: QueryRunner,
  ): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "idempotency_records" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "idempotency_key" text NOT NULL,
        "request_hash" text NOT NULL,
        "principal_user_id" uuid NOT NULL,
        "scope_key" text,
        "status" text NOT NULL DEFAULT 'in_progress',
        "status_code" integer,
        "result" jsonb,
        "expires_at" timestamptz NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "ck_idempotency_status" CHECK ("status" IN
          ('in_progress', 'completed'))
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_idempotency_key_principal"
         ON "idempotency_records" ("idempotency_key", "principal_user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_idempotency_expires"
         ON "idempotency_records" ("expires_at")`,
    );
  }

  private async createNotifications(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "notifications" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
        "team_id" uuid REFERENCES "teams" ("id") ON DELETE SET NULL,
        "category" text NOT NULL,
        "event_type" text NOT NULL,
        "title_key" text NOT NULL,
        "body_key" text NOT NULL,
        "params" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "dedupe_key" text NOT NULL,
        "read_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "ck_notification_category" CHECK ("category" IN
          ('member_lifecycle', 'practice', 'attendance', 'system'))
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_notifications_dedupe"
         ON "notifications" ("dedupe_key")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_notifications_user_time"
         ON "notifications" ("user_id", "created_at" DESC)`,
    );
  }

  private async createNotificationPreferences(
    queryRunner: QueryRunner,
  ): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "notification_preferences" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
        "category" text NOT NULL,
        "channel" text NOT NULL,
        "enabled" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "ck_pref_category" CHECK ("category" IN
          ('member_lifecycle', 'practice', 'attendance', 'system')),
        CONSTRAINT "ck_pref_channel" CHECK ("channel" IN
          ('in_app', 'email', 'push'))
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_preferences_user_cat_chan"
         ON "notification_preferences" ("user_id", "category", "channel")`,
    );
  }

  private async createNotificationDeliveries(
    queryRunner: QueryRunner,
  ): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "notification_deliveries" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "notification_id" uuid NOT NULL REFERENCES "notifications" ("id")
          ON DELETE CASCADE,
        "channel" text NOT NULL,
        "status" text NOT NULL,
        "last_error" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "ck_delivery_status" CHECK ("status" IN
          ('pending', 'sent', 'failed')),
        CONSTRAINT "ck_delivery_channel" CHECK ("channel" IN
          ('in_app', 'email', 'push'))
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_deliveries_notification"
         ON "notification_deliveries" ("notification_id")`,
    );
  }
}
