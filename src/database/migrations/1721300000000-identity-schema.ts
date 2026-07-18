import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Identity schema. Creates the invitation-based account and session-lifecycle
 * tables: users, password_credentials, invitations, refresh_sessions,
 * password_reset_tokens, failed_login_state, and the append-only security_events
 * audit log. Builds on the baseline (pgcrypto → gen_random_uuid()).
 *
 * Conventions (docs/database.md): UUID PKs, timestamptz in UTC, snake_case,
 * created_at/updated_at audit columns, deleted_at soft delete on users, an
 * optimistic version column on mutated aggregates, partial unique indexes where
 * soft-delete interacts with natural-key uniqueness. No secret or plaintext token
 * is ever stored — only bcrypt password hashes and sha-256 opaque-token hashes.
 * Fully reversible: down drops exactly what up created, in dependency order.
 */
export class IdentitySchema1721300000000 implements MigrationInterface {
  name = 'IdentitySchema1721300000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "email" text NOT NULL,
        "role" text NOT NULL DEFAULT 'user',
        "status" text NOT NULL,
        "display_name" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,
        "version" integer NOT NULL DEFAULT 1
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_users_email_active" ON "users" (lower("email")) WHERE "deleted_at" IS NULL`,
    );

    await queryRunner.query(`
      CREATE TABLE "password_credentials" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
        "password_hash" text NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "version" integer NOT NULL DEFAULT 1
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_password_credentials_user" ON "password_credentials" ("user_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "invitations" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "email" text NOT NULL,
        "token_hash" text NOT NULL,
        "invited_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "role" text NOT NULL DEFAULT 'user',
        "status" text NOT NULL,
        "expires_at" timestamptz NOT NULL,
        "accepted_at" timestamptz,
        "revoked_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_invitations_token_hash" ON "invitations" ("token_hash")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_invitations_email_pending" ON "invitations" (lower("email")) WHERE "status" = 'pending'`,
    );

    await queryRunner.query(`
      CREATE TABLE "refresh_sessions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
        "token_hash" text NOT NULL,
        "family_id" uuid NOT NULL,
        "device_label" text,
        "issued_at" timestamptz NOT NULL DEFAULT now(),
        "expires_at" timestamptz NOT NULL,
        "rotated_at" timestamptz,
        "revoked_at" timestamptz,
        "reuse_detected_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_refresh_sessions_token_hash" ON "refresh_sessions" ("token_hash")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_refresh_sessions_user" ON "refresh_sessions" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_refresh_sessions_family" ON "refresh_sessions" ("family_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "password_reset_tokens" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
        "token_hash" text NOT NULL,
        "expires_at" timestamptz NOT NULL,
        "consumed_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_password_reset_tokens_token_hash" ON "password_reset_tokens" ("token_hash")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_password_reset_tokens_user" ON "password_reset_tokens" ("user_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "failed_login_state" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "email" text NOT NULL,
        "attempt_count" integer NOT NULL DEFAULT 0,
        "first_attempt_at" timestamptz NOT NULL DEFAULT now(),
        "locked_until" timestamptz,
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_failed_login_state_email" ON "failed_login_state" (lower("email"))`,
    );

    await queryRunner.query(`
      CREATE TABLE "security_events" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "event_type" text NOT NULL,
        "actor_user_id" uuid,
        "context" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "occurred_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_security_events_type_time" ON "security_events" ("event_type", "occurred_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_security_events_actor" ON "security_events" ("actor_user_id")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "security_events"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "failed_login_state"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "password_reset_tokens"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "refresh_sessions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "invitations"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "password_credentials"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users"`);
  }
}
