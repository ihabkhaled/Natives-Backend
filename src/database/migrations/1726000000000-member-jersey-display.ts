import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The shirt number exactly as printed, alongside the numeric one.
 *
 * `jersey_number` is an integer, which cannot represent two things the real
 * roster contains: a leading zero ("011" is not 11), and two players whose
 * printed numbers normalise to the same integer — the per-team unique index
 * rightly rejects the second. Widening the integer column would ripple through
 * every DTO, policy and validator that reads it, so the printed form gets its
 * own nullable text column instead, used for display only and never for
 * uniqueness or ordering.
 *
 * Backfilled from the existing integers so no row loses its number. Fully
 * reversible: down drops exactly what up created.
 */
export class MemberJerseyDisplay1726000000000 implements MigrationInterface {
  name = 'MemberJerseyDisplay1726000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "member_profiles" ADD COLUMN "jersey_display" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "member_profiles" ADD CONSTRAINT
         "ck_profile_jersey_display_length" CHECK
         ("jersey_display" IS NULL OR char_length("jersey_display") <= 8)`,
    );
    await queryRunner.query(
      `UPDATE "member_profiles"
          SET "jersey_display" = "jersey_number"::text
        WHERE "jersey_number" IS NOT NULL`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "member_profiles" DROP CONSTRAINT
         "ck_profile_jersey_display_length"`,
    );
    await queryRunner.query(
      `ALTER TABLE "member_profiles" DROP COLUMN "jersey_display"`,
    );
  }
}
