import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Team scope for invitations. Adds a nullable `team_id` scope column so an
 * invitation can carry the team it onboards into: acceptance links the invited
 * membership pre-created in that team and grants the default MEMBER role there.
 * A NULL `team_id` keeps the platform-scoped invitation shape (super admin)
 * working unchanged, so existing rows need no backfill.
 *
 * Like `user_role_assignments.team_id`, this is a plain nullable UUID scope
 * column (no foreign key): the identity schema migrates before the teams schema
 * exists, and the members module — not identity — owns team existence checks in
 * the onboarding flow. Fully reversible: down drops exactly what up created.
 */
export class InvitationsTeamScope1724800000000 implements MigrationInterface {
  name = 'InvitationsTeamScope1724800000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "invitations" ADD COLUMN "team_id" uuid`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_invitations_team" ON "invitations" ("team_id")
        WHERE "team_id" IS NOT NULL`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "ix_invitations_team"`);
    await queryRunner.query(
      `ALTER TABLE "invitations" DROP COLUMN IF EXISTS "team_id"`,
    );
  }
}
