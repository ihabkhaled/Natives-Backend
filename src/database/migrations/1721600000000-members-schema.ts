import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Members / player-profiles / media / aliases schema. Separates the account
 * (users), the team membership, and the player profile so historical players and
 * candidates need no login:
 *
 *   - memberships               person-in-a-team lifecycle record; nullable
 *                               user_id (no login), explicit status state machine,
 *                               effective time + actor audit, soft delete +
 *                               optimistic version. A partial unique index enforces
 *                               one non-terminal membership per user/team/season.
 *   - media_assets              avatar metadata only; bytes live in object storage
 *                               (signed URLs), never as DB blobs; content type/
 *                               size/dimension + malware-scan state + ownership.
 *   - member_profiles           1:1 with a membership; EN/AR/preferred names,
 *                               nickname, contacts, jersey number/size, gender/
 *                               division, positions, height/weight, DOB, avatar.
 *   - membership_status_events  append-only lifecycle history (never updated).
 *   - member_aliases            normalized import aliases; a partial unique index
 *                               enforces scoped active-alias uniqueness.
 *
 * Conventions (docs/database.md): UUID PKs via pgcrypto gen_random_uuid(),
 * timestamptz in UTC, date-only DOB, snake_case, created_at/updated_at audit
 * columns, created_by/updated_by actor columns, optimistic version on the mutable
 * profile/membership aggregates, partial unique indexes for natural keys that
 * interact with soft delete. Fully reversible: down drops exactly what up created,
 * in dependency order.
 *
 * Deferred (documented): a database-level exclusion constraint for scoped active
 * jersey uniqueness (spans membership status/season) — enforced and tested in the
 * application layer, mirroring the season-overlap approach; and season/team
 * composite consistency, owned by the future roster module.
 */
export class MembersSchema1721600000000 implements MigrationInterface {
  name = 'MembersSchema1721600000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await this.createMemberships(queryRunner);
    await this.createMediaAssets(queryRunner);
    await this.createMemberProfiles(queryRunner);
    await this.createStatusEvents(queryRunner);
    await this.createAliases(queryRunner);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "member_aliases"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "membership_status_events"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "member_profiles"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "media_assets"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "memberships"`);
  }

  private async createMemberships(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "memberships" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "team_id" uuid NOT NULL REFERENCES "teams" ("id") ON DELETE CASCADE,
        "season_id" uuid REFERENCES "seasons" ("id") ON DELETE SET NULL,
        "user_id" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "status" text NOT NULL DEFAULT 'invited',
        "status_reason" text,
        "status_effective_at" timestamptz NOT NULL DEFAULT now(),
        "joined_at" timestamptz,
        "left_at" timestamptz,
        "anonymized_at" timestamptz,
        "created_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "updated_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,
        "version" integer NOT NULL DEFAULT 1,
        CONSTRAINT "ck_memberships_status" CHECK ("status" IN
          ('invited', 'active', 'inactive', 'suspended', 'left', 'archived',
           'anonymized'))
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_memberships_user_team_season"
         ON "memberships" ("team_id", "user_id",
           COALESCE("season_id", '00000000-0000-0000-0000-000000000000'::uuid))
        WHERE "user_id" IS NOT NULL AND "deleted_at" IS NULL
          AND "status" NOT IN ('archived', 'anonymized', 'left')`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_memberships_team_status"
         ON "memberships" ("team_id", "status") WHERE "deleted_at" IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_memberships_user" ON "memberships" ("user_id")
        WHERE "user_id" IS NOT NULL`,
    );
  }

  private async createMediaAssets(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "media_assets" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "team_id" uuid NOT NULL REFERENCES "teams" ("id") ON DELETE CASCADE,
        "membership_id" uuid NOT NULL REFERENCES "memberships" ("id")
          ON DELETE CASCADE,
        "purpose" text NOT NULL DEFAULT 'avatar',
        "storage_key" text NOT NULL,
        "content_type" text NOT NULL,
        "byte_size" bigint NOT NULL,
        "width" integer,
        "height" integer,
        "scan_status" text NOT NULL DEFAULT 'pending',
        "created_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,
        CONSTRAINT "ck_media_byte_size_positive" CHECK ("byte_size" > 0),
        CONSTRAINT "ck_media_scan_status" CHECK ("scan_status" IN
          ('pending', 'clean', 'infected', 'failed'))
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_media_storage_key" ON "media_assets" ("storage_key")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_media_membership" ON "media_assets" ("membership_id")
        WHERE "deleted_at" IS NULL`,
    );
  }

  private async createMemberProfiles(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "member_profiles" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "membership_id" uuid NOT NULL UNIQUE REFERENCES "memberships" ("id")
          ON DELETE CASCADE,
        "team_id" uuid NOT NULL REFERENCES "teams" ("id") ON DELETE CASCADE,
        "full_name" text NOT NULL,
        "preferred_name" text,
        "full_name_ar" text,
        "nickname" text,
        "email" text,
        "phone" text,
        "gender" text,
        "division" text,
        "positions" text[] NOT NULL DEFAULT '{}',
        "jersey_number" integer,
        "jersey_size" text,
        "height_cm" numeric(5, 2),
        "weight_kg" numeric(5, 2),
        "date_of_birth" date,
        "avatar_media_id" uuid REFERENCES "media_assets" ("id")
          ON DELETE SET NULL,
        "created_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "updated_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "version" integer NOT NULL DEFAULT 1,
        CONSTRAINT "ck_profile_jersey_range" CHECK ("jersey_number" IS NULL
          OR ("jersey_number" >= 0 AND "jersey_number" <= 999))
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_profiles_team_jersey"
         ON "member_profiles" ("team_id", "jersey_number")
        WHERE "jersey_number" IS NOT NULL`,
    );
  }

  private async createStatusEvents(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "membership_status_events" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "membership_id" uuid NOT NULL REFERENCES "memberships" ("id")
          ON DELETE CASCADE,
        "from_status" text,
        "to_status" text NOT NULL,
        "reason" text,
        "actor_user_id" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "effective_at" timestamptz NOT NULL,
        "occurred_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_status_events_membership"
         ON "membership_status_events" ("membership_id", "occurred_at")`,
    );
  }

  private async createAliases(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "member_aliases" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "membership_id" uuid NOT NULL REFERENCES "memberships" ("id")
          ON DELETE CASCADE,
        "team_id" uuid NOT NULL REFERENCES "teams" ("id") ON DELETE CASCADE,
        "alias" text NOT NULL,
        "normalized_alias" text NOT NULL,
        "source" text NOT NULL DEFAULT 'manual',
        "created_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,
        CONSTRAINT "ck_alias_source" CHECK ("source" IN ('manual', 'import'))
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_aliases_team_normalized"
         ON "member_aliases" ("team_id", "normalized_alias")
        WHERE "deleted_at" IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_aliases_membership"
         ON "member_aliases" ("membership_id") WHERE "deleted_at" IS NULL`,
    );
  }
}
