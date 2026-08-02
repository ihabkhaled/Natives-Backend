import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Shirt numbers become text.
 *
 * A shirt number is a printed label, not a quantity: "011" is not 11, and the
 * leading zero is part of it. Modelling it as an integer silently normalised
 * those away and made two distinct numbers collide. Nothing ever did
 * arithmetic on it.
 *
 * Existing values carry over via ::text. The interim `jersey_display` column
 * added by 1726000000000 becomes redundant and is folded back in: where it
 * holds a value it wins, because it is the printed form.
 *
 * The partial index is dropped and recreated so it is rebuilt against the new
 * column type. Fully reversible, with the caveat named in `down`.
 */
export class JerseyNumberAsText1726100000000 implements MigrationInterface {
  name = 'JerseyNumberAsText1726100000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "ix_profiles_team_jersey"`);
    await queryRunner.query(
      `ALTER TABLE "member_profiles" DROP CONSTRAINT IF EXISTS
         "ck_profile_jersey_range"`,
    );
    await queryRunner.query(
      `ALTER TABLE "member_profiles"
         ALTER COLUMN "jersey_number" TYPE text
         USING COALESCE("jersey_display", "jersey_number"::text)`,
    );
    await queryRunner.query(
      `ALTER TABLE "member_profiles" DROP CONSTRAINT IF EXISTS
         "ck_profile_jersey_display_length"`,
    );
    await queryRunner.query(
      `ALTER TABLE "member_profiles" DROP COLUMN IF EXISTS "jersey_display"`,
    );
    // One to four characters, digits only — permits a leading zero, rejects
    // whitespace, signs and free text.
    await queryRunner.query(
      `ALTER TABLE "member_profiles" ADD CONSTRAINT "ck_profile_jersey_format"
         CHECK ("jersey_number" IS NULL OR "jersey_number" ~ '^[0-9]{1,4}$')`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_profiles_team_jersey"
         ON "member_profiles" ("team_id", "jersey_number")
        WHERE "jersey_number" IS NOT NULL`,
    );

    // roster_entries carries the same concept and must agree with the profile
    // it is selected from, or a roster would renumber a player on selection.
    await queryRunner.query(`DROP INDEX IF EXISTS "ux_entries_roster_jersey"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "ix_entries_roster_status"`);
    await queryRunner.query(
      `ALTER TABLE "roster_entries" DROP CONSTRAINT IF EXISTS "ck_entry_jersey"`,
    );
    await queryRunner.query(
      `ALTER TABLE "roster_entries"
         ALTER COLUMN "jersey_number" TYPE text USING "jersey_number"::text`,
    );
    await queryRunner.query(
      `ALTER TABLE "roster_entries" ADD CONSTRAINT "ck_entry_jersey"
         CHECK ("jersey_number" IS NULL OR "jersey_number" ~ '^[0-9]{1,4}$')`,
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

  /**
   * Reverses the column type. Any leading zero is lost on the way back, which
   * is inherent to the integer representation this restores — that loss is
   * exactly why the column was widened.
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

    await queryRunner.query(`DROP INDEX IF EXISTS "ix_profiles_team_jersey"`);
    await queryRunner.query(
      `ALTER TABLE "member_profiles" DROP CONSTRAINT IF EXISTS
         "ck_profile_jersey_format"`,
    );
    await queryRunner.query(
      `ALTER TABLE "member_profiles"
         ALTER COLUMN "jersey_number" TYPE integer
         USING NULLIF("jersey_number", '')::integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "member_profiles" ADD CONSTRAINT "ck_profile_jersey_range"
         CHECK ("jersey_number" IS NULL
           OR ("jersey_number" >= 0 AND "jersey_number" <= 999))`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_profiles_team_jersey"
         ON "member_profiles" ("team_id", "jersey_number")
        WHERE "jersey_number" IS NOT NULL`,
    );
  }
}
