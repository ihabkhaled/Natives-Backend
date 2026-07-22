import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Team-role scope for invitations. An invitation now records WHICH team role
 * acceptance grants (`team_role_key`, the stored uppercase role key), instead
 * of hard-coding MEMBER at accept time. The default keeps every existing and
 * legacy row granting exactly what it did before. The CHECK mirrors the role
 * KEY shape (`^[A-Z][A-Z0-9_]*$`) rather than the seeded six-role enum — the
 * catalog is open and tenant-defined bundles must remain invitable. Fully
 * reversible: down drops exactly what up created.
 */
export class InvitationTeamRole1725100000000 implements MigrationInterface {
  name = 'InvitationTeamRole1725100000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "invitations"
         ADD COLUMN "team_role_key" text NOT NULL DEFAULT 'MEMBER'`,
    );
    await queryRunner.query(
      `ALTER TABLE "invitations" ADD CONSTRAINT "ck_invitations_team_role_key"
        CHECK ("team_role_key" ~ '^[A-Z][A-Z0-9_]*$')`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "invitations"
        DROP CONSTRAINT IF EXISTS "ck_invitations_team_role_key"`,
    );
    await queryRunner.query(
      `ALTER TABLE "invitations" DROP COLUMN IF EXISTS "team_role_key"`,
    );
  }
}
