import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * P4 BE-1 catalog correction: `rules.read`, `governance.read`, and `jersey.read`
 * existed in the permission catalog but sat in NO default role bundle, so
 * members could not read the team rules they must acknowledge and team admins
 * held only the manage grants while every GET endpoint demands the read grant
 * (there is no manage⊃read implication anywhere in the auth core).
 *
 * Grants seeded (mirroring the in-code bundles in @shared/constants/role-bundles
 * for databases already seeded by 1721400000000-rbac-schema):
 *   - MEMBER:      rules.read, jersey.read
 *   - COACH:       rules.read, jersey.read       (COACH extends MEMBER)
 *   - TEAM_ADMIN:  rules.read, jersey.read, governance.read
 *   - ANALYST:     unchanged — the persona matrix marks governance read for
 *                  analysts as optional; least privilege wins by default.
 *
 * Also disambiguates the two rules domains in the seeded catalog descriptions
 * (P4 BE-6): `rules.read`/`rules.manage` are the GOVERNANCE team-rules grants,
 * `points.rules.manage` is the points CALCULATION rules grant. The keys were
 * already distinct — only the human descriptions were ambiguous.
 *
 * Idempotent via ON CONFLICT DO NOTHING / absolute description updates; bumps
 * the RBAC policy version so resolver caches invalidate. Fully reversible: down
 * removes exactly these grants and restores the previous descriptions.
 */
const READ_GRANTS: readonly (readonly [string, string])[] = [
  ['MEMBER', 'rules.read'],
  ['MEMBER', 'jersey.read'],
  ['COACH', 'rules.read'],
  ['COACH', 'jersey.read'],
  ['TEAM_ADMIN', 'rules.read'],
  ['TEAM_ADMIN', 'jersey.read'],
  ['TEAM_ADMIN', 'governance.read'],
];

const DESCRIPTIONS_UP: readonly (readonly [string, string])[] = [
  ['rules.read', 'View governance team rules'],
  ['rules.manage', 'Manage governance team rules'],
  ['points.rules.manage', 'Manage points calculation rules'],
];

const DESCRIPTIONS_DOWN: readonly (readonly [string, string])[] = [
  ['rules.read', 'View rules'],
  ['rules.manage', 'Manage rules'],
  ['points.rules.manage', 'Manage points rules'],
];

export class GovernanceJerseyReadGrants1725400000000 implements MigrationInterface {
  name = 'GovernanceJerseyReadGrants1725400000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    for (const [roleKey, permissionKey] of READ_GRANTS) {
      await queryRunner.query(
        `INSERT INTO "role_permissions" ("role_id", "permission_id")
         SELECT r."id", p."id" FROM "roles" r, "permissions" p
          WHERE r."key" = $1 AND p."key" = $2
         ON CONFLICT DO NOTHING`,
        [roleKey, permissionKey],
      );
    }
    await this.applyDescriptions(queryRunner, DESCRIPTIONS_UP);
    await this.bumpPolicyVersion(queryRunner);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    for (const [roleKey, permissionKey] of READ_GRANTS) {
      await queryRunner.query(
        `DELETE FROM "role_permissions" rp
          USING "roles" r, "permissions" p
          WHERE rp."role_id" = r."id" AND rp."permission_id" = p."id"
            AND r."key" = $1 AND p."key" = $2`,
        [roleKey, permissionKey],
      );
    }
    await this.applyDescriptions(queryRunner, DESCRIPTIONS_DOWN);
    await this.bumpPolicyVersion(queryRunner);
  }

  private async applyDescriptions(
    queryRunner: QueryRunner,
    descriptions: readonly (readonly [string, string])[],
  ): Promise<void> {
    for (const [permissionKey, description] of descriptions) {
      await queryRunner.query(
        `UPDATE "permissions" SET "description" = $2 WHERE "key" = $1`,
        [permissionKey, description],
      );
    }
  }

  private async bumpPolicyVersion(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "rbac_policy_version"
          SET "version" = "version" + 1, "updated_at" = now()
        WHERE "singleton" = true`,
    );
  }
}
