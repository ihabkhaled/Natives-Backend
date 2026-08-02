import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Public team-profile fields for the landing site / team directory (P0):
 * location, founding date, and social URLs. All nullable — an unset field
 * simply does not render on the public page.
 *
 * The seed-once framework never re-runs a seeder whose definition changed on
 * a database it already applied (by design — see `seed-checksum`), so the
 * team seeder's v2 bump (which now writes these columns) only reaches a
 * FRESH database. An already-seeded database's "un" team needs its profile
 * backfilled here instead, guarded by `IS NULL` so it can never clobber a
 * value an admin already edited. Fully reversible: down drops exactly what
 * up added (the backfilled values go with the dropped columns).
 */
export class TeamPublicProfile1725900000000 implements MigrationInterface {
  name = 'TeamPublicProfile1725900000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "teams" ADD COLUMN "location" text`);
    await queryRunner.query(`ALTER TABLE "teams" ADD COLUMN "founded_on" date`);
    await queryRunner.query(
      `ALTER TABLE "teams" ADD COLUMN "facebook_url" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "teams" ADD COLUMN "instagram_url" text`,
    );
    await queryRunner.query(`ALTER TABLE "teams" ADD COLUMN "tiktok_url" text`);
    await this.backfillRealTeam(queryRunner);
  }

  private async backfillRealTeam(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "teams"
          SET "location" = $2, "founded_on" = $3, "facebook_url" = $4,
              "instagram_url" = $5, "tiktok_url" = $6
        WHERE lower("slug") = $1 AND "location" IS NULL`,
      [
        'un',
        'El Sheikh Zayed, Giza, Egypt',
        '2021-10-01',
        'https://www.facebook.com/ultimatenatives',
        'https://www.instagram.com/ultimatenatives',
        'https://www.tiktok.com/@ultimate.natives',
      ],
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "teams" DROP COLUMN IF EXISTS "tiktok_url"`,
    );
    await queryRunner.query(
      `ALTER TABLE "teams" DROP COLUMN IF EXISTS "instagram_url"`,
    );
    await queryRunner.query(
      `ALTER TABLE "teams" DROP COLUMN IF EXISTS "facebook_url"`,
    );
    await queryRunner.query(
      `ALTER TABLE "teams" DROP COLUMN IF EXISTS "founded_on"`,
    );
    await queryRunner.query(
      `ALTER TABLE "teams" DROP COLUMN IF EXISTS "location"`,
    );
  }
}
