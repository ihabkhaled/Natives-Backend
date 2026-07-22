import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Role-catalog assignability metadata. Every role gains an explicit `scope`
 * (`team` or `platform`) and an `is_assignable` flag, so "which roles may a
 * team-scoped flow hand out" is a database fact instead of a hard-coded list.
 * SUPER_ADMIN is stamped platform-scoped and unassignable, which makes it
 * structurally impossible to grant through an ordinary team invitation or a
 * team role replacement — the separately protected platform promotion flow is
 * the only path. Existing roles keep working unchanged via the defaults
 * (`team`, assignable). Fully reversible: down drops exactly what up created.
 */
export class RbacRoleCatalogMetadata1725000000000 implements MigrationInterface {
  name = 'RbacRoleCatalogMetadata1725000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "roles" ADD COLUMN "scope" text NOT NULL DEFAULT 'team'
        CONSTRAINT "ck_roles_scope" CHECK ("scope" IN ('team','platform'))`,
    );
    await queryRunner.query(
      `ALTER TABLE "roles"
         ADD COLUMN "is_assignable" boolean NOT NULL DEFAULT true`,
    );
    await queryRunner.query(
      `UPDATE "roles" SET "scope" = 'platform', "is_assignable" = false
        WHERE "key" = 'SUPER_ADMIN'`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "roles" DROP COLUMN IF EXISTS "is_assignable"`,
    );
    await queryRunner.query(
      `ALTER TABLE "roles" DROP COLUMN IF EXISTS "scope"`,
    );
  }
}
