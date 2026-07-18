import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Revocable practice-calendar credentials and self-owned notification quiet
 * hours. Calendar credentials persist only a SHA-256 digest; the bearer value is
 * shown once and never recoverable from the database.
 */
export class PracticeRemindersCalendarSchema1722200000000 implements MigrationInterface {
  name = 'PracticeRemindersCalendarSchema1722200000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await this.createCalendarFeeds(queryRunner);
    await this.createQuietHours(queryRunner);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "notification_quiet_hours"`);
    await queryRunner.query(
      `DROP TABLE IF EXISTS "practice_calendar_feed_tokens"`,
    );
  }

  private async createCalendarFeeds(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "practice_calendar_feed_tokens" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "token_digest" char(64) NOT NULL UNIQUE,
        "user_id" uuid NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
        "team_id" uuid NOT NULL REFERENCES "teams" ("id") ON DELETE CASCADE,
        "season_id" uuid REFERENCES "seasons" ("id") ON DELETE CASCADE,
        "timezone" text NOT NULL DEFAULT 'Africa/Cairo',
        "expires_at" timestamptz NOT NULL,
        "revoked_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "ck_calendar_feed_digest" CHECK
          ("token_digest" ~ '^[a-f0-9]{64}$'),
        CONSTRAINT "ck_calendar_feed_expiry" CHECK
          ("expires_at" > "created_at")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_calendar_feeds_owner_team_active"
         ON "practice_calendar_feed_tokens"
           ("user_id", "team_id", "expires_at")
        WHERE "revoked_at" IS NULL`,
    );
  }

  private async createQuietHours(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "notification_quiet_hours" (
        "user_id" uuid PRIMARY KEY REFERENCES "users" ("id") ON DELETE CASCADE,
        "timezone" text NOT NULL DEFAULT 'Africa/Cairo',
        "starts_local" text NOT NULL DEFAULT '22:00',
        "ends_local" text NOT NULL DEFAULT '07:00',
        "urgent_cancellation_override" boolean NOT NULL DEFAULT true,
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "ck_quiet_hours_start" CHECK
          ("starts_local" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
        CONSTRAINT "ck_quiet_hours_end" CHECK
          ("ends_local" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
      )
    `);
  }
}
