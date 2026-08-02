import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Finishes the shirt-number widening, and corrects two seeded roster rows.
 *
 * `1726100000000` converts both tables on a fresh database, but any database
 * that applied an earlier revision of that file got `member_profiles` only —
 * the migration had already run there, and a migration that has run is never
 * edited into correctness. Every statement here is therefore guarded so it is
 * a no-op wherever the work is already done.
 *
 * The data fixes belong here rather than in the roster seeder for the same
 * reason: that seeder has already been applied, and the framework will not
 * re-run a seeder whose definition changed.
 *
 * - The Season Board coach was seeded under his nickname. Two different people
 *   are called Sherif Ashraf — the coach ("3alamy") and a player ("Nemo") — so
 *   the name is corrected and the nickname is what tells them apart.
 * - Mahmoud Nasr wears "011". It was seeded null because the column could not
 *   hold a leading zero at the time.
 */
export class RosterJerseyTextAndNameFix1726200000000
  implements MigrationInterface
{
  name = 'RosterJerseyTextAndNameFix1726200000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
           WHERE table_name = 'roster_entries'
             AND column_name = 'jersey_number'
             AND data_type = 'integer'
        ) THEN
          DROP INDEX IF EXISTS "ux_entries_roster_jersey";
          DROP INDEX IF EXISTS "ix_entries_roster_status";
          ALTER TABLE "roster_entries"
            DROP CONSTRAINT IF EXISTS "ck_entry_jersey";
          ALTER TABLE "roster_entries"
            ALTER COLUMN "jersey_number" TYPE text
            USING "jersey_number"::text;
          ALTER TABLE "roster_entries" ADD CONSTRAINT "ck_entry_jersey"
            CHECK ("jersey_number" IS NULL
              OR "jersey_number" ~ '^[0-9]{1,4}$');
          CREATE UNIQUE INDEX "ux_entries_roster_jersey"
            ON "roster_entries" ("roster_id", "jersey_number")
            WHERE "jersey_number" IS NOT NULL AND "status" = 'selected';
          CREATE INDEX "ix_entries_roster_status"
            ON "roster_entries" ("roster_id", "status", "jersey_number");
        END IF;
      END $$;
    `);

    await queryRunner.query(
      `UPDATE "member_profiles"
          SET "full_name" = 'Sherif Ashraf'
        WHERE "full_name" = '3alamy' AND "nickname" = '3alamy'`,
    );
    await queryRunner.query(
      `UPDATE "member_profiles"
          SET "jersey_number" = '011'
        WHERE "full_name" = 'Mahmoud Nasr'
          AND "nickname" = 'Hoodz'
          AND "jersey_number" IS NULL`,
    );
  }

  /**
   * The data corrections are not reversed: restoring a name known to be wrong
   * is not a service to anyone. Only the column type is put back.
   */
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "ux_entries_roster_jersey"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "ix_entries_roster_status"`);
    await queryRunner.query(
      `ALTER TABLE "roster_entries" DROP CONSTRAINT IF EXISTS "ck_entry_jersey"`,
    );
    await queryRunner.query(
      `ALTER TABLE "roster_entries"
         ALTER COLUMN "jersey_number" TYPE integer
         USING NULLIF("jersey_number", '')::integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "roster_entries" ADD CONSTRAINT "ck_entry_jersey"
         CHECK ("jersey_number" IS NULL OR
           ("jersey_number" >= 0 AND "jersey_number" <= 999))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_entries_roster_jersey"
         ON "roster_entries" ("roster_id", "jersey_number")
        WHERE "jersey_number" IS NOT NULL AND "status" = 'selected'`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_entries_roster_status"
         ON "roster_entries" ("roster_id", "status", "jersey_number")`,
    );
  }
}
