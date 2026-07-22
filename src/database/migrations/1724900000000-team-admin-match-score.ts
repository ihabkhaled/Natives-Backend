import type { MigrationInterface, QueryRunner } from 'typeorm';

const TEAM_ADMIN_ROLE_KEY = 'TEAM_ADMIN';
const MATCH_SCORE_PERMISSION_KEY = 'match.score';

/**
 * Privilege-ceiling catalog correction: grant `match.score` to the TEAM_ADMIN
 * bundle. The assignable-roles ceiling only offers a role whose every permission
 * the actor already holds, so without `match.score` a team administrator could
 * never assign SCOREKEEPER — the runtime audit confirmed Scorekeeper missing
 * from the Team Admin's assignable list. TEAM_ADMIN is documented as "full
 * administration of a team", which includes live match scoring.
 *
 * Mirrors the in-code catalog change in @shared/constants/role-bundles for
 * databases already seeded by 1721400000000-rbac-schema. Idempotent via ON
 * CONFLICT DO NOTHING; bumps the RBAC policy version so resolver caches
 * invalidate. Fully reversible: down removes exactly this grant.
 */
export class TeamAdminMatchScore1724900000000 implements MigrationInterface {
  name = 'TeamAdminMatchScore1724900000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `INSERT INTO "role_permissions" ("role_id", "permission_id")
       SELECT r."id", p."id" FROM "roles" r, "permissions" p
        WHERE r."key" = $1 AND p."key" = $2
       ON CONFLICT DO NOTHING`,
      [TEAM_ADMIN_ROLE_KEY, MATCH_SCORE_PERMISSION_KEY],
    );
    await this.bumpPolicyVersion(queryRunner);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "role_permissions" rp
        USING "roles" r, "permissions" p
        WHERE rp."role_id" = r."id" AND rp."permission_id" = p."id"
          AND r."key" = $1 AND p."key" = $2`,
      [TEAM_ADMIN_ROLE_KEY, MATCH_SCORE_PERMISSION_KEY],
    );
    await this.bumpPolicyVersion(queryRunner);
  }

  private async bumpPolicyVersion(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "rbac_policy_version"
          SET "version" = "version" + 1, "updated_at" = now()
        WHERE "singleton" = true`,
    );
  }
}
