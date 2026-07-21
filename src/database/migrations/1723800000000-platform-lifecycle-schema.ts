import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Platform-administration + team/season lifecycle schema.
 *
 * Three concerns, one reversible migration:
 *
 *  1. The platform-scope permissions (`platform.admin`, `team.create`,
 *     `team.browse.all`) and the SUPER_ADMIN role bundle that carries the whole
 *     catalog. These three permissions are deliberately absent from every
 *     team-scoped bundle (MEMBER/COACH/TEAM_ADMIN/SCOREKEEPER/ANALYST), so a
 *     team-scoped assignment can never satisfy a platform-scoped route: that is
 *     what separates the web-app super admin from a team administrator.
 *
 *  2. Team lifecycle. `teams.status` gains the intermediate `disabled` state and
 *     a CHECK constraint pinning the state set; `teams.deleted_at` records the
 *     soft removal that replaces any hard delete (historical rows stay
 *     referentially valid — nothing is ever removed).
 *
 *  3. Season lifecycle. `seasons.status` gains `closed` and a CHECK constraint,
 *     and a PARTIAL UNIQUE INDEX makes "the team's current season" a database
 *     invariant rather than a convention: at most one `active` season per team,
 *     so `period=season` on the leaderboard always resolves deterministically.
 *     Pre-existing data is normalised first — where a team already has more than
 *     one active season the newest (greatest starts_on, id as tie-break) stays
 *     active and the rest move to `closed`, a deterministic, order-independent
 *     rule that preserves every row.
 *
 * The permission/role seed is inlined and uses ON CONFLICT DO NOTHING so it is a
 * no-op on re-run, exactly like 1721400000000-rbac-schema. Fully reversible: down
 * removes precisely what up added, in dependency order, and restores the previous
 * (unconstrained) status columns without discarding any row.
 */

// [key, area, description] — mirrors @shared/constants/permission-catalog.
const PLATFORM_PERMISSION_SEED: readonly (readonly [string, string, string])[] =
  [
    ['platform.admin', 'platform', 'Administer the platform across every team'],
    ['team.create', 'platform', 'Create a new team'],
    ['team.browse.all', 'platform', 'Browse every team on the platform'],
  ];

const SUPER_ADMIN_ROLE_KEY = 'SUPER_ADMIN';
const SUPER_ADMIN_DISPLAY_NAME = 'Super administrator';
const SUPER_ADMIN_DESCRIPTION = 'Platform-wide administrator across every team';

export class PlatformLifecycleSchema1723800000000 implements MigrationInterface {
  name = 'PlatformLifecycleSchema1723800000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await this.seedPlatformPermissions(queryRunner);
    await this.seedSuperAdminRole(queryRunner);
    await this.alterTeams(queryRunner);
    await this.normaliseActiveSeasons(queryRunner);
    await this.alterSeasons(queryRunner);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "ux_seasons_one_active_per_team"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "ix_seasons_team_current"`);
    await queryRunner.query(
      `ALTER TABLE "seasons" DROP CONSTRAINT IF EXISTS "ck_seasons_status"`,
    );
    await queryRunner.query(
      `UPDATE "seasons" SET "status" = 'draft' WHERE "status" = 'closed'`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "ix_teams_status"`);
    await queryRunner.query(
      `ALTER TABLE "teams" DROP CONSTRAINT IF EXISTS "ck_teams_status"`,
    );
    await queryRunner.query(
      `UPDATE "teams" SET "status" = 'active' WHERE "status" = 'disabled'`,
    );
    await queryRunner.query(
      `ALTER TABLE "teams" DROP COLUMN IF EXISTS "deleted_at"`,
    );
    await this.removeSuperAdminRole(queryRunner);
  }

  /**
   * Reverses the catalog seed without ever discarding granted authority: the
   * role and its permissions are removed only while no assignment references
   * them. A database where somebody was actually made a super admin keeps the
   * role (and its audit trail) rather than silently revoking it.
   */
  private async removeSuperAdminRole(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "roles" r
        WHERE r."key" = $1
          AND NOT EXISTS (
            SELECT 1 FROM "user_role_assignments" a WHERE a."role_id" = r."id"
          )`,
      [SUPER_ADMIN_ROLE_KEY],
    );
    await queryRunner.query(
      `DELETE FROM "permissions" p
        WHERE p."key" = ANY($1::text[])
          AND NOT EXISTS (
            SELECT 1 FROM "role_permissions" rp
             WHERE rp."permission_id" = p."id"
          )`,
      [PLATFORM_PERMISSION_SEED.map(entry => entry[0])],
    );
  }

  private async seedPlatformPermissions(
    queryRunner: QueryRunner,
  ): Promise<void> {
    for (const [key, area, description] of PLATFORM_PERMISSION_SEED) {
      await queryRunner.query(
        `INSERT INTO "permissions" ("key", "area", "description")
         VALUES ($1, $2, $3) ON CONFLICT ("key") DO NOTHING`,
        [key, area, description],
      );
    }
  }

  private async seedSuperAdminRole(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `INSERT INTO "roles" ("key", "display_name", "description", "is_system")
       VALUES ($1, $2, $3, true) ON CONFLICT ("key") DO NOTHING`,
      [SUPER_ADMIN_ROLE_KEY, SUPER_ADMIN_DISPLAY_NAME, SUPER_ADMIN_DESCRIPTION],
    );
    await queryRunner.query(
      `INSERT INTO "role_permissions" ("role_id", "permission_id")
       SELECT r."id", p."id" FROM "roles" r CROSS JOIN "permissions" p
        WHERE r."key" = $1
       ON CONFLICT DO NOTHING`,
      [SUPER_ADMIN_ROLE_KEY],
    );
  }

  private async alterTeams(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "teams" ADD COLUMN IF NOT EXISTS "deleted_at" timestamptz`,
    );
    await queryRunner.query(
      `ALTER TABLE "teams" ADD CONSTRAINT "ck_teams_status"
         CHECK ("status" IN ('active', 'disabled', 'archived'))`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_teams_status" ON "teams" ("status", "created_at")`,
    );
  }

  private async normaliseActiveSeasons(
    queryRunner: QueryRunner,
  ): Promise<void> {
    await queryRunner.query(`
      UPDATE "seasons" SET "status" = 'closed'
       WHERE "status" = 'active'
         AND "id" NOT IN (
           SELECT DISTINCT ON ("team_id") "id" FROM "seasons"
            WHERE "status" = 'active'
            ORDER BY "team_id", "starts_on" DESC, "id" DESC
         )
    `);
  }

  private async alterSeasons(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "seasons" ADD CONSTRAINT "ck_seasons_status"
         CHECK ("status" IN ('draft', 'active', 'closed', 'archived'))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_seasons_one_active_per_team"
         ON "seasons" ("team_id") WHERE "status" = 'active'`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_seasons_team_current"
         ON "seasons" ("team_id", "starts_on" DESC, "id" DESC)`,
    );
  }
}
