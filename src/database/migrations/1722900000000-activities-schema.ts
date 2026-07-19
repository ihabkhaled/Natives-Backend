import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * External training bounded context (UN-400): the versioned activity-type
 * catalog, member submissions, private evidence, and training buddies.
 *
 *   - activity_types            versioned catalog of outside-practice activity
 *                               types. `default_point_value` is a CANDIDATE per
 *                               type (Gym 2, Running 2, Throwing Session 4, …) and
 *                               is NULL with `points_approval = 'pending'` for
 *                               WFDF accreditation and custom activities, so no
 *                               point value is ever guessed. A submission is a
 *                               claim; the catalog never awards points here.
 *   - activity_submissions      a member's outside-practice claim: activity type,
 *                               performed date, optional duration/quantity
 *                               (null-not-zero) and private notes, moving through
 *                               draft → submitted → under_review →
 *                               changes_requested → approved/rejected/withdrawn/
 *                               reversed. Optimistic version + soft delete. A
 *                               partial unique index blocks a duplicate live claim
 *                               for the same member/type/date.
 *   - activity_evidence         evidence metadata + a PRIVATE storage reference
 *                               only (no bytes). Read is reviewer-scoped; the
 *                               reference never reaches a member view. A unique
 *                               (submission, reference) blocks duplicate evidence.
 *   - activity_buddies          co-participants credited on one submission. Each
 *                               buddy link is pending until the credited member
 *                               confirms or declines. Unique per submission+member.
 *
 * Conventions: UUID PKs, timestamptz UTC, snake_case, check constraints for every
 * enum column, bounded/ordered covering indexes, idempotent seed via ON CONFLICT.
 * Additive and fully reversible; changes no existing table. Down drops exactly
 * what up created, in dependency order.
 */

// [typeKey, name, description, category, unit, points, approval]
const ACTIVITY_TYPE_SEED: readonly (readonly [
  string,
  string,
  string,
  string,
  string | null,
  number | null,
  string,
])[] = [
  [
    'gym',
    'Gym',
    'A gym or strength-and-conditioning session.',
    'gym',
    'minutes',
    2,
    'approved',
  ],
  [
    'running',
    'Running',
    'A running or cardio conditioning session.',
    'running',
    'minutes',
    2,
    'approved',
  ],
  [
    'throwing',
    'Throwing Session',
    'A dedicated disc throwing practice session.',
    'throwing',
    'session',
    4,
    'approved',
  ],
  [
    'pickup',
    'Pickup',
    'An informal pickup ultimate game.',
    'pickup',
    'session',
    2,
    'approved',
  ],
  [
    'another_sport',
    'Another Sport',
    'Cross-training in another organised sport.',
    'other_sport',
    'session',
    1,
    'approved',
  ],
  [
    'team_drills',
    'Team Drills',
    'Extra team drills outside a scheduled practice.',
    'team_drills',
    'session',
    2,
    'approved',
  ],
  [
    'rules_quiz',
    'Rules Quiz',
    'Completing an ultimate rules quiz.',
    'rules_quiz',
    'quiz',
    2,
    'approved',
  ],
  [
    'wfdf_accreditation',
    'WFDF Accreditation',
    'A WFDF rules accreditation. Point value is pending approval and is not yet decided.',
    'accreditation',
    'accreditation',
    null,
    'pending',
  ],
  [
    'custom',
    'Custom Activity',
    'A custom outside-practice activity. Point value is pending review approval.',
    'custom',
    null,
    null,
    'pending',
  ],
];

export class ActivitiesSchema1722900000000 implements MigrationInterface {
  name = 'ActivitiesSchema1722900000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await this.createActivityTypes(queryRunner);
    await this.createSubmissions(queryRunner);
    await this.createEvidence(queryRunner);
    await this.createBuddies(queryRunner);
    await this.seedActivityTypes(queryRunner);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "activity_buddies"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "activity_evidence"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "activity_submissions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "activity_types"`);
  }

  private async createActivityTypes(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "activity_types" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "family_id" uuid NOT NULL,
        "type_key" text NOT NULL,
        "name" text NOT NULL,
        "description" text NOT NULL,
        "category" text NOT NULL,
        "unit" text,
        "default_point_value" numeric,
        "points_approval" text NOT NULL DEFAULT 'approved',
        "requires_evidence" boolean NOT NULL DEFAULT false,
        "min_duration_minutes" integer,
        "max_duration_minutes" integer,
        "status" text NOT NULL DEFAULT 'active',
        "catalog_version" integer NOT NULL DEFAULT 1,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "ux_activity_type_key_version"
          UNIQUE ("type_key", "catalog_version"),
        CONSTRAINT "ck_activity_type_category" CHECK ("category" IN
          ('gym', 'running', 'throwing', 'pickup', 'other_sport', 'team_drills',
           'rules_quiz', 'accreditation', 'custom')),
        CONSTRAINT "ck_activity_type_points_approval"
          CHECK ("points_approval" IN ('approved', 'pending')),
        CONSTRAINT "ck_activity_type_status"
          CHECK ("status" IN ('active', 'archived')),
        CONSTRAINT "ck_activity_type_version" CHECK ("catalog_version" > 0),
        CONSTRAINT "ck_activity_type_points"
          CHECK ("default_point_value" IS NULL OR "default_point_value" >= 0),
        CONSTRAINT "ck_activity_type_duration_bounds" CHECK
          ("min_duration_minutes" IS NULL OR "max_duration_minutes" IS NULL
           OR "min_duration_minutes" <= "max_duration_minutes"),
        CONSTRAINT "ck_activity_type_pending_points" CHECK
          ("points_approval" = 'approved' OR "default_point_value" IS NULL)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_activity_types_active"
         ON "activity_types" ("status", "category", "type_key", "id")`,
    );
  }

  private async createSubmissions(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "activity_submissions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "team_id" uuid NOT NULL REFERENCES "teams" ("id") ON DELETE CASCADE,
        "season_id" uuid REFERENCES "seasons" ("id") ON DELETE SET NULL,
        "membership_id" uuid NOT NULL REFERENCES "memberships" ("id")
          ON DELETE CASCADE,
        "activity_type_id" uuid NOT NULL REFERENCES "activity_types" ("id")
          ON DELETE RESTRICT,
        "submitter_user_id" uuid NOT NULL REFERENCES "users" ("id")
          ON DELETE RESTRICT,
        "status" text NOT NULL DEFAULT 'draft',
        "performed_on" date NOT NULL,
        "duration_minutes" integer,
        "quantity" numeric,
        "notes" text,
        "review_note" text,
        "record_version" integer NOT NULL DEFAULT 1,
        "submitted_at" timestamptz,
        "submitted_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "reviewed_at" timestamptz,
        "reviewed_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "withdrawn_at" timestamptz,
        "created_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,
        CONSTRAINT "ck_activity_submission_status" CHECK ("status" IN
          ('draft', 'submitted', 'under_review', 'changes_requested',
           'approved', 'rejected', 'withdrawn', 'reversed')),
        CONSTRAINT "ck_activity_submission_version" CHECK ("record_version" > 0),
        CONSTRAINT "ck_activity_submission_duration"
          CHECK ("duration_minutes" IS NULL OR "duration_minutes" > 0),
        CONSTRAINT "ck_activity_submission_quantity"
          CHECK ("quantity" IS NULL OR "quantity" >= 0)
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_activity_submission_dedupe"
         ON "activity_submissions"
          ("membership_id", "activity_type_id", "performed_on")
        WHERE "deleted_at" IS NULL
          AND "status" NOT IN ('withdrawn', 'rejected', 'reversed')`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_activity_submissions_team_list"
         ON "activity_submissions" ("team_id", "created_at" DESC, "id")
        WHERE "deleted_at" IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_activity_submissions_member"
         ON "activity_submissions" ("membership_id", "status", "created_at" DESC)
        WHERE "deleted_at" IS NULL`,
    );
  }

  private async createEvidence(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "activity_evidence" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "submission_id" uuid NOT NULL REFERENCES "activity_submissions" ("id")
          ON DELETE CASCADE,
        "kind" text NOT NULL DEFAULT 'link',
        "storage_reference" text NOT NULL,
        "content_type" text,
        "byte_size" bigint,
        "description" text,
        "scan_status" text NOT NULL DEFAULT 'pending',
        "created_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "ck_activity_evidence_kind"
          CHECK ("kind" IN ('link', 'file', 'note')),
        CONSTRAINT "ck_activity_evidence_scan_status"
          CHECK ("scan_status" IN ('pending', 'clean', 'infected', 'failed')),
        CONSTRAINT "ck_activity_evidence_byte_size"
          CHECK ("byte_size" IS NULL OR "byte_size" > 0),
        CONSTRAINT "ux_activity_evidence_reference"
          UNIQUE ("submission_id", "storage_reference")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_activity_evidence_submission"
         ON "activity_evidence" ("submission_id", "created_at", "id")`,
    );
  }

  private async createBuddies(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "activity_buddies" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "submission_id" uuid NOT NULL REFERENCES "activity_submissions" ("id")
          ON DELETE CASCADE,
        "membership_id" uuid NOT NULL REFERENCES "memberships" ("id")
          ON DELETE CASCADE,
        "status" text NOT NULL DEFAULT 'pending',
        "responded_at" timestamptz,
        "responded_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "ck_activity_buddy_status"
          CHECK ("status" IN ('pending', 'confirmed', 'declined')),
        CONSTRAINT "ux_activity_buddy_once"
          UNIQUE ("submission_id", "membership_id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_activity_buddies_member"
         ON "activity_buddies" ("membership_id", "status", "created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_activity_buddies_submission"
         ON "activity_buddies" ("submission_id", "created_at", "id")`,
    );
  }

  private async seedActivityTypes(queryRunner: QueryRunner): Promise<void> {
    for (const [
      typeKey,
      name,
      description,
      category,
      unit,
      points,
      approval,
    ] of ACTIVITY_TYPE_SEED) {
      await queryRunner.query(
        `WITH seed AS (SELECT gen_random_uuid() AS "id")
         INSERT INTO "activity_types"
          ("id", "family_id", "type_key", "name", "description", "category",
           "unit", "default_point_value", "points_approval", "catalog_version")
         SELECT seed."id", seed."id", $1, $2, $3, $4, $5, $6, $7, 1
           FROM seed
         ON CONFLICT ("type_key", "catalog_version") DO NOTHING`,
        [typeKey, name, description, category, unit, points, approval],
      );
    }
  }
}
