import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Teams / seasons / venues / reference-catalogs / versioned-settings schema.
 * Creates the stable team-scoped configuration and reference data every sports
 * module builds on:
 *
 *   - teams                       one primary team now, team scope preserved for
 *                                 future mixed/open/women/academy structures
 *   - seasons                     team-scoped, explicit dates + status; overlap
 *                                 policy enforced in the application layer
 *   - venues                      team-scoped playing locations
 *   - reference_catalog_entries   configurable catalogs (divisions, gender
 *                                 formats, positions, ...) archived not deleted;
 *                                 a reference_count guards deletion-while-in-use
 *   - team_setting_versions       append-only, effective-dated settings (attendance
 *                                 weights, session types, assessment scales, badge
 *                                 tiers, roster limits, notification rules, report
 *                                 branding) resolved into a deterministic snapshot
 *
 * Conventions (docs/database.md): UUID PKs via pgcrypto gen_random_uuid(),
 * timestamptz in UTC, date-only columns for season boundaries, snake_case,
 * created_at/updated_at audit columns, created_by/updated_by actor columns,
 * optimistic version column on mutable aggregates, status-based soft archive
 * (historical reference values are archived/versioned, never deleted), partial
 * unique indexes for natural keys. Setting versions are immutable once written;
 * a change is a new row with a later effective_from. Fully reversible: down drops
 * exactly what up created, in dependency order.
 *
 * Deferred (documented): a database-level EXCLUDE constraint for season-date
 * overlap (needs btree_gist) — overlap is enforced and tested in the application
 * layer; and team/season composite foreign keys into downstream modules that do
 * not yet exist.
 */
export class TeamsSchema1721500000000 implements MigrationInterface {
  name = 'TeamsSchema1721500000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await this.createTeams(queryRunner);
    await this.createSeasons(queryRunner);
    await this.createVenues(queryRunner);
    await this.createCatalogEntries(queryRunner);
    await this.createSettingVersions(queryRunner);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "team_setting_versions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "reference_catalog_entries"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "venues"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "seasons"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "teams"`);
  }

  private async createTeams(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "teams" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "slug" text NOT NULL,
        "name" text NOT NULL,
        "locale" text NOT NULL DEFAULT 'en',
        "timezone" text NOT NULL DEFAULT 'Africa/Cairo',
        "primary_color" text,
        "logo_media_key" text,
        "status" text NOT NULL DEFAULT 'active',
        "created_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "updated_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "version" integer NOT NULL DEFAULT 1
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_teams_slug" ON "teams" (lower("slug"))`,
    );
  }

  private async createSeasons(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "seasons" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "team_id" uuid NOT NULL REFERENCES "teams" ("id") ON DELETE CASCADE,
        "slug" text NOT NULL,
        "name" text NOT NULL,
        "starts_on" date NOT NULL,
        "ends_on" date NOT NULL,
        "status" text NOT NULL DEFAULT 'draft',
        "created_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "updated_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "version" integer NOT NULL DEFAULT 1,
        CONSTRAINT "ck_seasons_date_order" CHECK ("ends_on" >= "starts_on")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_seasons_team_slug" ON "seasons" ("team_id", lower("slug"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_seasons_team_status" ON "seasons" ("team_id", "status")`,
    );
  }

  private async createVenues(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "venues" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "team_id" uuid NOT NULL REFERENCES "teams" ("id") ON DELETE CASCADE,
        "name" text NOT NULL,
        "address" text,
        "timezone" text NOT NULL DEFAULT 'Africa/Cairo',
        "latitude" numeric(9, 6),
        "longitude" numeric(9, 6),
        "status" text NOT NULL DEFAULT 'active',
        "created_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "updated_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "version" integer NOT NULL DEFAULT 1
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_venues_team_name" ON "venues" ("team_id", lower("name"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_venues_team_status" ON "venues" ("team_id", "status")`,
    );
  }

  private async createCatalogEntries(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "reference_catalog_entries" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "team_id" uuid NOT NULL REFERENCES "teams" ("id") ON DELETE CASCADE,
        "catalog" text NOT NULL,
        "key" text NOT NULL,
        "label" text NOT NULL,
        "sort_order" integer NOT NULL DEFAULT 0,
        "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "reference_count" integer NOT NULL DEFAULT 0,
        "status" text NOT NULL DEFAULT 'active',
        "created_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "updated_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "version" integer NOT NULL DEFAULT 1,
        CONSTRAINT "ck_catalog_reference_count_non_negative"
          CHECK ("reference_count" >= 0)
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_catalog_team_catalog_key"
         ON "reference_catalog_entries" ("team_id", "catalog", "key")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_catalog_team_catalog_sort"
         ON "reference_catalog_entries" ("team_id", "catalog", "status", "sort_order")`,
    );
  }

  private async createSettingVersions(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "team_setting_versions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "team_id" uuid NOT NULL REFERENCES "teams" ("id") ON DELETE CASCADE,
        "setting_key" text NOT NULL,
        "effective_from" timestamptz NOT NULL,
        "value" jsonb NOT NULL,
        "note" text,
        "created_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_setting_versions_team_key_from"
         ON "team_setting_versions" ("team_id", "setting_key", "effective_from")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_setting_versions_lookup"
         ON "team_setting_versions" ("team_id", "setting_key", "effective_from" DESC)`,
    );
  }
}
