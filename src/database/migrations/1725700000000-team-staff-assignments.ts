import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Team staff assignments: links a membership to one or more staff-title
 * catalog entries (Coach, Co-Coach, Spirit Captain, Finance, Social Media &
 * Marketing, Analysis, Technical — seeded as `reference_catalog_entries` rows
 * under the new `staff_title` catalog, reusing the existing extensible catalog
 * mechanism rather than a parallel table). A person may hold multiple titles
 * (multiple rows). `photo_url` is a nullable direct URL so the public "who's
 * who" can render a staff photo once one is supplied — distinct from the
 * private, signed-URL member avatar pipeline.
 *
 * Assignments are archived (`status` -> 'removed'), never hard-deleted,
 * matching every other reference/history table in this schema. The partial
 * unique index allows re-assigning a previously removed title without a
 * unique-constraint conflict, while blocking a duplicate concurrently-active
 * assignment of the same title to the same person.
 *
 * Fully reversible: down drops exactly what up created.
 */
export class TeamStaffAssignments1725700000000 implements MigrationInterface {
  name = 'TeamStaffAssignments1725700000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "team_staff_assignments" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "team_id" uuid NOT NULL REFERENCES "teams" ("id") ON DELETE CASCADE,
        "membership_id" uuid NOT NULL REFERENCES "memberships" ("id")
          ON DELETE CASCADE,
        "title_entry_id" uuid NOT NULL REFERENCES "reference_catalog_entries" ("id")
          ON DELETE RESTRICT,
        "photo_url" text,
        "status" text NOT NULL DEFAULT 'active',
        "created_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "removed_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "removed_at" timestamptz,
        "version" integer NOT NULL DEFAULT 1,
        CONSTRAINT "ck_staff_assignment_status" CHECK ("status" IN
          ('active', 'removed')),
        CONSTRAINT "ck_staff_assignment_photo_url_length" CHECK
          (char_length("photo_url") <= 2048),
        CONSTRAINT "ck_staff_assignment_version" CHECK ("version" > 0)
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_staff_assignments_active"
         ON "team_staff_assignments" ("team_id", "membership_id",
           "title_entry_id")
        WHERE "status" = 'active'`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_staff_assignments_team_status"
         ON "team_staff_assignments" ("team_id", "status", "membership_id")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "team_staff_assignments"`);
  }
}
