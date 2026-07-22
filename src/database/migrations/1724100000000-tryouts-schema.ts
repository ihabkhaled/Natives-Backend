import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Tryout events, candidates, consent, check-in, evaluations, decisions, offers,
 * and member conversion (UN-600, UN-601). Five additive tables; it changes no
 * existing table and grants no new permission (tryout.* is already seeded).
 *
 *   - tryout_events        a dated session with a venue, a capacity, a
 *                          registration window, an eligibility note, the CONSENT
 *                          VERSION a registrant must accept, and a public or
 *                          invite-only visibility.
 *   - tryout_candidates    a person who registered. Deliberately minimal: a
 *                          display name, ONE contact channel + reference, the
 *                          optional prior-sport/referral/motivation answers, the
 *                          accepted consent version, the check-in instant, a
 *                          readiness classification and restricted health notes,
 *                          a duplicate pointer, and the retention/anonymization
 *                          fields. A national ID column does not exist, so it
 *                          cannot be collected. A candidate is NOT a user: the
 *                          membership link is written only at conversion.
 *   - tryout_evaluations   one evaluator's ORIGINAL observation of a candidate:
 *                          attendance, per-criterion ratings, public
 *                          observations, restricted private notes, and a
 *                          recommendation, under a named criteria version.
 *                          Originals are kept per evaluator and aggregated for
 *                          reading — an aggregate never overwrites an original.
 *   - tryout_decisions     the human committee decision with its reasons and the
 *                          criteria version it was taken under. Append-only: a
 *                          reconsideration adds a later decision.
 *   - tryout_offers        the candidate-facing offer with its expiry and
 *                          response. Exactly one live offer per candidate.
 *
 * Conventions: UUID PKs, timestamptz UTC, snake_case, check constraints
 * mirroring the enums, optimistic record_version, bounded indexes. Reversible.
 */
export class TryoutsSchema1724100000000 implements MigrationInterface {
  name = 'TryoutsSchema1724100000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await this.createEvents(queryRunner);
    await this.createCandidates(queryRunner);
    await this.createEvaluations(queryRunner);
    await this.createDecisions(queryRunner);
    await this.createOffers(queryRunner);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "tryout_offers"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "tryout_decisions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "tryout_evaluations"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "tryout_candidates"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "tryout_events"`);
  }

  private async createEvents(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "tryout_events" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "team_id" uuid NOT NULL REFERENCES "teams" ("id") ON DELETE CASCADE,
        "season_id" uuid NOT NULL REFERENCES "seasons" ("id") ON DELETE CASCADE,
        "venue_id" uuid REFERENCES "venues" ("id") ON DELETE SET NULL,
        "name" text NOT NULL,
        "capacity" integer,
        "registration_opens_at" timestamptz NOT NULL,
        "registration_closes_at" timestamptz NOT NULL,
        "starts_at" timestamptz NOT NULL,
        "ends_at" timestamptz NOT NULL,
        "visibility" text NOT NULL DEFAULT 'invite_only',
        "consent_version" text NOT NULL,
        "eligibility_note" text,
        "retention_days" integer NOT NULL DEFAULT 365,
        "status" text NOT NULL DEFAULT 'draft',
        "record_version" integer NOT NULL DEFAULT 1,
        "created_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "opened_at" timestamptz,
        "closed_at" timestamptz,
        "completed_at" timestamptz,
        "cancelled_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "ck_tryout_event_visibility" CHECK ("visibility" IN
          ('public', 'invite_only')),
        CONSTRAINT "ck_tryout_event_status" CHECK ("status" IN
          ('draft', 'open', 'closed', 'completed', 'cancelled')),
        CONSTRAINT "ck_tryout_event_window" CHECK
          ("registration_closes_at" > "registration_opens_at"),
        CONSTRAINT "ck_tryout_event_schedule" CHECK ("ends_at" > "starts_at"),
        CONSTRAINT "ck_tryout_event_capacity" CHECK
          ("capacity" IS NULL OR "capacity" > 0),
        CONSTRAINT "ck_tryout_event_retention" CHECK ("retention_days" > 0)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_tryout_events_scope"
         ON "tryout_events" ("team_id", "starts_at" DESC, "id")`,
    );
  }

  private async createCandidates(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "tryout_candidates" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "team_id" uuid NOT NULL REFERENCES "teams" ("id") ON DELETE CASCADE,
        "event_id" uuid NOT NULL REFERENCES "tryout_events" ("id")
          ON DELETE CASCADE,
        "display_name" text NOT NULL,
        "identity_hash" text NOT NULL,
        "contact_channel" text NOT NULL,
        "contact_reference" text,
        "prior_sport" text,
        "referral_source" text,
        "motivation" text,
        "communication_opt_in" boolean NOT NULL DEFAULT false,
        "consent_version" text NOT NULL,
        "consented_at" timestamptz NOT NULL,
        "readiness" text NOT NULL DEFAULT 'unknown',
        "restricted_notes" text,
        "status" text NOT NULL DEFAULT 'registered',
        "waitlist_position" integer,
        "checked_in_at" timestamptz,
        "withdrawn_at" timestamptz,
        "duplicate_of_candidate_id" uuid
          REFERENCES "tryout_candidates" ("id") ON DELETE SET NULL,
        "converted_membership_id" uuid REFERENCES "memberships" ("id")
          ON DELETE SET NULL,
        "converted_at" timestamptz,
        "retention_expires_at" timestamptz NOT NULL,
        "anonymized_at" timestamptz,
        "record_version" integer NOT NULL DEFAULT 1,
        "created_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "ck_candidate_channel" CHECK ("contact_channel" IN
          ('email', 'phone', 'whatsapp', 'none')),
        CONSTRAINT "ck_candidate_readiness" CHECK ("readiness" IN
          ('ready', 'limited', 'injured', 'unknown')),
        CONSTRAINT "ck_candidate_status" CHECK ("status" IN
          ('registered', 'waitlisted', 'checked_in', 'no_show', 'withdrawn',
           'accepted', 'rejected', 'converted')),
        CONSTRAINT "ck_candidate_waitlist" CHECK
          ("waitlist_position" IS NULL OR "waitlist_position" > 0)
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_candidates_event_identity"
         ON "tryout_candidates" ("event_id", "identity_hash")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_candidates_queue"
         ON "tryout_candidates" ("team_id", "event_id", "status", "id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_candidates_retention"
         ON "tryout_candidates" ("retention_expires_at")
         WHERE "anonymized_at" IS NULL`,
    );
  }

  private async createEvaluations(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "tryout_evaluations" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "team_id" uuid NOT NULL REFERENCES "teams" ("id") ON DELETE CASCADE,
        "candidate_id" uuid NOT NULL REFERENCES "tryout_candidates" ("id")
          ON DELETE CASCADE,
        "evaluator_user_id" uuid NOT NULL REFERENCES "users" ("id")
          ON DELETE CASCADE,
        "criteria_version" text NOT NULL,
        "attended" boolean NOT NULL DEFAULT true,
        "ratings" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "observations" text,
        "private_notes" text,
        "recommendation" text NOT NULL DEFAULT 'undecided',
        "status" text NOT NULL DEFAULT 'draft',
        "record_version" integer NOT NULL DEFAULT 1,
        "submitted_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "ck_evaluation_recommendation" CHECK ("recommendation" IN
          ('accept', 'waitlist', 'reject', 'undecided')),
        CONSTRAINT "ck_evaluation_status" CHECK ("status" IN
          ('draft', 'submitted')),
        CONSTRAINT "ux_evaluation_candidate_evaluator"
          UNIQUE ("candidate_id", "evaluator_user_id")
      )
    `);
  }

  private async createDecisions(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "tryout_decisions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "team_id" uuid NOT NULL REFERENCES "teams" ("id") ON DELETE CASCADE,
        "candidate_id" uuid NOT NULL REFERENCES "tryout_candidates" ("id")
          ON DELETE CASCADE,
        "decision" text NOT NULL,
        "reasons" text NOT NULL,
        "criteria_version" text NOT NULL,
        "evaluator_count" integer NOT NULL DEFAULT 0,
        "decided_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "decided_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "ck_decision_value" CHECK ("decision" IN
          ('accept', 'waitlist', 'reject', 'withdraw')),
        CONSTRAINT "ck_decision_evaluators" CHECK ("evaluator_count" >= 0)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_decisions_candidate"
         ON "tryout_decisions" ("candidate_id", "decided_at" DESC, "id")`,
    );
    await queryRunner.query(
      `CREATE RULE "rl_tryout_decisions_immutable" AS
         ON UPDATE TO "tryout_decisions" DO INSTEAD NOTHING`,
    );
  }

  private async createOffers(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "tryout_offers" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "team_id" uuid NOT NULL REFERENCES "teams" ("id") ON DELETE CASCADE,
        "candidate_id" uuid NOT NULL REFERENCES "tryout_candidates" ("id")
          ON DELETE CASCADE,
        "status" text NOT NULL DEFAULT 'draft',
        "candidate_message" text,
        "expires_at" timestamptz NOT NULL,
        "sent_at" timestamptz,
        "responded_at" timestamptz,
        "record_version" integer NOT NULL DEFAULT 1,
        "created_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "ck_offer_status" CHECK ("status" IN
          ('draft', 'sent', 'accepted', 'declined', 'expired', 'withdrawn'))
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_offers_live_candidate"
         ON "tryout_offers" ("candidate_id")
         WHERE "status" IN ('draft', 'sent')`,
    );
  }
}
