import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * P4 B4: persist WHY an achievement claim was rejected. `reject` is a terminal
 * transition, and until now it was mute — reviewers had to abuse the
 * description to explain a rejection. The transition DTO now accepts an
 * optional bounded reason which is stored on the row (reject only) and
 * returned, so a rejected claim carries its own explanation forever.
 *
 * Additive and idempotent (ADD COLUMN IF NOT EXISTS); fully reversible.
 */
export class AchievementRejectionReason1725500000000 implements MigrationInterface {
  name = 'AchievementRejectionReason1725500000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "team_achievements"
         ADD COLUMN IF NOT EXISTS "rejection_reason" text`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "team_achievements"
         DROP COLUMN IF EXISTS "rejection_reason"`,
    );
  }
}
