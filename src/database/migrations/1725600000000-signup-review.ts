import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Self-signup review tracking. Self-signed-up accounts land in the users table
 * with status 'pending' (a free-text lifecycle status, so no enum migration is
 * needed) and stay inert until an admin reviews them. This records WHO reviewed
 * a signup and WHEN at the row level, mirroring the invitations table's
 * accepted_at/revoked_at audit columns, so an approval/rejection is recoverable
 * from the aggregate as well as the append-only security_events log.
 *
 * `signup_reviewed_by` references the reviewing admin and survives their deletion
 * as NULL (ON DELETE SET NULL), matching invitations.invited_by. Fully
 * reversible: down drops exactly what up created.
 */
export class SignupReview1725600000000 implements MigrationInterface {
  name = 'SignupReview1725600000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users"
         ADD COLUMN "signup_reviewed_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN "signup_reviewed_at" timestamptz`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "signup_reviewed_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "signup_reviewed_by"`,
    );
  }
}
