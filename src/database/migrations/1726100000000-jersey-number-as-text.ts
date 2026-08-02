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
 *
 * Scoped to member_profiles only. roster_entries carries the same concept and
 * is converted by 1726200000000, which guards on the table existing — so a
 * test that migrates a narrow slice of the schema can run this one without
 * needing the rosters tables to be present.
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
  }

  /**
   * Reverses the column type, and restores the `jersey_display` column `up`
   * folded away. Restoring it is not optional bookkeeping: `1726000000000`
   * created that column and its `down` drops it, so leaving it absent made the
   * older migration fail on the way back down. It is recreated before
   * `jersey_number` narrows, so it keeps the printed form — which is where any
   * leading zero survives. The integer column itself loses it, as it always
   * did; that loss is exactly why the column was widened.
   */
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "ix_profiles_team_jersey"`);
    await queryRunner.query(
      `ALTER TABLE "member_profiles" DROP CONSTRAINT IF EXISTS
         "ck_profile_jersey_format"`,
    );
    // Put 1726000000000's column back, carrying the printed form across before
    // the narrowing below discards it.
    await queryRunner.query(
      `ALTER TABLE "member_profiles"
         ADD COLUMN IF NOT EXISTS "jersey_display" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "member_profiles" ADD CONSTRAINT
         "ck_profile_jersey_display_length" CHECK
         ("jersey_display" IS NULL OR char_length("jersey_display") <= 8)`,
    );
    await queryRunner.query(
      `UPDATE "member_profiles"
          SET "jersey_display" = "jersey_number"
        WHERE "jersey_number" IS NOT NULL`,
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
