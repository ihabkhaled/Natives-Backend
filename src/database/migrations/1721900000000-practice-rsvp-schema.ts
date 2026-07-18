import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Practice RSVP / availability / waitlist schema. RSVP is intention (going / not
 * going / maybe / no response) — it is deliberately separate from attendance and
 * never awards points. Two tables:
 *
 *   - practice_rsvps          the single EFFECTIVE response per member/session.
 *                             A partial-free unique index (session_id, membership_id)
 *                             enforces "one effective RSVP per member/session"; the
 *                             row carries reason category, a member note + its
 *                             visibility, the source (self/coach/admin/import/
 *                             system), a waitlist flag (only a `going` response may
 *                             be waitlisted), the response instant, actor audit, and
 *                             an optimistic version for mobile races.
 *   - practice_rsvp_revisions append-only history of every response change
 *                             (including coach overrides with a reason and waitlist
 *                             promotions). Never updated or deleted, so intent
 *                             history is preserved even after a session is cancelled.
 *
 * Conventions (docs/database.md): UUID PKs via pgcrypto gen_random_uuid(),
 * timestamptz in UTC, snake_case, created_at/updated_at + created_by/updated_by
 * audit columns, optimistic version on the mutable rsvp aggregate, check
 * constraints mirroring the enums, bounded indexes. Fully reversible: down drops
 * exactly what up created, in dependency order.
 */
export class PracticeRsvpSchema1721900000000 implements MigrationInterface {
  name = 'PracticeRsvpSchema1721900000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await this.createRsvps(queryRunner);
    await this.createRevisions(queryRunner);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "practice_rsvp_revisions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "practice_rsvps"`);
  }

  private async createRsvps(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "practice_rsvps" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "session_id" uuid NOT NULL REFERENCES "practice_sessions" ("id")
          ON DELETE CASCADE,
        "team_id" uuid NOT NULL REFERENCES "teams" ("id") ON DELETE CASCADE,
        "season_id" uuid REFERENCES "seasons" ("id") ON DELETE SET NULL,
        "membership_id" uuid NOT NULL REFERENCES "memberships" ("id")
          ON DELETE CASCADE,
        "user_id" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "status" text NOT NULL,
        "reason_category" text,
        "note" text,
        "note_visibility" text NOT NULL DEFAULT 'coaches',
        "source" text NOT NULL DEFAULT 'self',
        "waitlisted" boolean NOT NULL DEFAULT false,
        "responded_at" timestamptz NOT NULL DEFAULT now(),
        "created_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "updated_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "version" integer NOT NULL DEFAULT 1,
        CONSTRAINT "ck_rsvp_status" CHECK ("status" IN
          ('going', 'not_going', 'maybe', 'no_response')),
        CONSTRAINT "ck_rsvp_reason_category" CHECK ("reason_category" IS NULL
          OR "reason_category" IN
          ('injury', 'work', 'travel', 'personal', 'other')),
        CONSTRAINT "ck_rsvp_note_visibility" CHECK ("note_visibility" IN
          ('coaches', 'team')),
        CONSTRAINT "ck_rsvp_source" CHECK ("source" IN
          ('self', 'coach', 'admin', 'import', 'system')),
        CONSTRAINT "ck_rsvp_waitlist_going" CHECK
          ("waitlisted" = false OR "status" = 'going')
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_practice_rsvps_session_membership"
         ON "practice_rsvps" ("session_id", "membership_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_practice_rsvps_session_status"
         ON "practice_rsvps" ("session_id", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_practice_rsvps_waitlist"
         ON "practice_rsvps" ("session_id", "responded_at")
        WHERE "status" = 'going' AND "waitlisted" = true`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_practice_rsvps_membership"
         ON "practice_rsvps" ("membership_id")`,
    );
  }

  private async createRevisions(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "practice_rsvp_revisions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "rsvp_id" uuid NOT NULL REFERENCES "practice_rsvps" ("id")
          ON DELETE CASCADE,
        "session_id" uuid NOT NULL REFERENCES "practice_sessions" ("id")
          ON DELETE CASCADE,
        "membership_id" uuid NOT NULL REFERENCES "memberships" ("id")
          ON DELETE CASCADE,
        "from_status" text,
        "to_status" text NOT NULL,
        "reason_category" text,
        "note" text,
        "waitlisted" boolean NOT NULL,
        "source" text NOT NULL,
        "is_override" boolean NOT NULL DEFAULT false,
        "override_reason" text,
        "actor_user_id" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "occurred_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "ck_rsvp_rev_to_status" CHECK ("to_status" IN
          ('going', 'not_going', 'maybe', 'no_response')),
        CONSTRAINT "ck_rsvp_rev_source" CHECK ("source" IN
          ('self', 'coach', 'admin', 'import', 'system'))
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_rsvp_revisions_rsvp"
         ON "practice_rsvp_revisions" ("rsvp_id", "occurred_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_rsvp_revisions_session_membership"
         ON "practice_rsvp_revisions" ("session_id", "membership_id",
           "occurred_at")`,
    );
  }
}
