import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Point lineups, possession events, corrections, and derived match statistics
 * (UN-504). Two additive tables plus one additive column — it drops nothing and
 * grants no new permission (match.read / match.score / match.stats.read are
 * already seeded and bundled by the RBAC baseline):
 *
 *   - match_rulesets.opponent_error_attribution
 *                        whether THESE versioned rules approve crediting a
 *                        forced opponent error to one of our players. It
 *                        defaults to false, and when it is false the statistics
 *                        projection reports that per-player figure as NULL —
 *                        "not evaluated under these rules" — never as a
 *                        misleading zero.
 *   - match_play_events  the append-only point/possession stream: `point_started`
 *                        (carrying the line that took the field), `point_completed`
 *                        (carrying the scoring side), every possession fact
 *                        between them, and `correction`, the compensating
 *                        retraction. Every row carries the CLIENT operation id and
 *                        a hash of its payload, uniquely constrained per match, so
 *                        an offline scorekeeper replaying the same operation
 *                        produces exactly one fact and the same id with a
 *                        different payload is a hard conflict. An ON UPDATE DO
 *                        INSTEAD NOTHING rule makes a recorded fact unrewritable
 *                        at the database level — a mistake is undone by APPENDING
 *                        a correction, and retracted-ness is derived from that
 *                        link rather than stamped onto history.
 *   - match_point_lineups  who was on the line for a point, hanging off the
 *                        `point_started` fact rather than off the match. Points
 *                        played is derived from these rows, so retracting a
 *                        point-start removes its whole line from the derivation
 *                        without rewriting anything — which is exactly what makes
 *                        a corrected stream rebuild to the same statistics as a
 *                        clean one.
 *
 * No statistic is stored anywhere: there is no totals table by design, because a
 * stored total would be an unexplained editable number. The projection is folded
 * from these rows on every read.
 *
 * A trigger closes the point stream of a finalized or abandoned match, mirroring
 * the guard UN-503 installed on the score stream, so published history cannot be
 * extended even from a direct SQL session.
 *
 * Conventions: UUID PKs via gen_random_uuid(), timestamptz UTC, snake_case, check
 * constraints mirroring the enums, partial unique indexes for the single
 * retraction per fact and the single puller per line. Fully reversible: down
 * drops the trigger, function, rules, tables, and the added column in dependency
 * order. Proven from empty by the integration + e2e suites.
 */
export class MatchLineupsSchema1723700000000 implements MigrationInterface {
  name = 'MatchLineupsSchema1723700000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await this.addRulesetAttribution(queryRunner);
    await this.createPlayEvents(queryRunner);
    await this.createPointLineups(queryRunner);
    await this.createStreamGuards(queryRunner);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS "tg_match_plays_closed_stream"
         ON "match_play_events"`,
    );
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS "fn_match_plays_closed_stream"()`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "match_point_lineups"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "match_play_events"`);
    await queryRunner.query(
      `ALTER TABLE "match_rulesets"
         DROP COLUMN IF EXISTS "opponent_error_attribution"`,
    );
  }

  private async addRulesetAttribution(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "match_rulesets"
         ADD COLUMN "opponent_error_attribution" boolean NOT NULL
         DEFAULT false`,
    );
  }

  private async createPlayEvents(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "match_play_events" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "match_id" uuid NOT NULL REFERENCES "matches" ("id") ON DELETE CASCADE,
        "team_id" uuid NOT NULL REFERENCES "teams" ("id") ON DELETE CASCADE,
        "sequence" integer NOT NULL,
        "operation_id" text NOT NULL,
        "request_hash" text NOT NULL,
        "play_type" text NOT NULL,
        "point_number" integer NOT NULL,
        "period" integer NOT NULL DEFAULT 1,
        "starting_line" text,
        "scoring_side" text,
        "primary_membership_id" uuid REFERENCES "memberships" ("id")
          ON DELETE SET NULL,
        "secondary_membership_id" uuid REFERENCES "memberships" ("id")
          ON DELETE SET NULL,
        "assist_state" text,
        "callahan" boolean NOT NULL DEFAULT false,
        "duration_seconds" integer,
        "corrects_play_id" uuid REFERENCES "match_play_events" ("id")
          ON DELETE SET NULL,
        "correction_reason" text,
        "notes" text,
        "recorded_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "occurred_at" timestamptz,
        "recorded_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "ck_play_type" CHECK ("play_type" IN
          ('point_started', 'point_completed', 'pull', 'throw', 'completion',
           'goal', 'drop', 'throwaway', 'block', 'stall', 'call', 'turnover',
           'substitution', 'opponent_drop', 'opponent_throwaway',
           'correction')),
        CONSTRAINT "ck_play_starting_line" CHECK ("starting_line" IS NULL OR
          "starting_line" IN ('offense', 'defense')),
        CONSTRAINT "ck_play_side" CHECK ("scoring_side" IS NULL OR
          "scoring_side" IN ('us', 'them')),
        CONSTRAINT "ck_play_assist_state" CHECK ("assist_state" IS NULL OR
          "assist_state" IN ('recorded', 'none', 'unknown')),
        CONSTRAINT "ck_play_assist_link" CHECK
          ("assist_state" <> 'recorded' OR
           "secondary_membership_id" IS NOT NULL),
        CONSTRAINT "ck_play_point_start" CHECK
          ("play_type" <> 'point_started' OR "starting_line" IS NOT NULL),
        CONSTRAINT "ck_play_point_complete" CHECK
          ("play_type" <> 'point_completed' OR "scoring_side" IS NOT NULL),
        CONSTRAINT "ck_play_correction" CHECK
          ("play_type" <> 'correction' OR ("corrects_play_id" IS NOT NULL
                                           AND "correction_reason" IS NOT NULL)),
        CONSTRAINT "ck_play_duration" CHECK
          ("duration_seconds" IS NULL OR "duration_seconds" >= 0),
        CONSTRAINT "ck_play_sequence" CHECK ("sequence" > 0),
        CONSTRAINT "ck_play_point_number" CHECK ("point_number" > 0),
        CONSTRAINT "ck_play_period" CHECK ("period" > 0)
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_plays_match_operation"
         ON "match_play_events" ("match_id", "operation_id")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_plays_match_sequence"
         ON "match_play_events" ("match_id", "sequence")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_plays_correction_target"
         ON "match_play_events" ("corrects_play_id")
        WHERE "corrects_play_id" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_plays_match_point"
         ON "match_play_events" ("match_id", "point_number", "play_type",
                                 "sequence")`,
    );
    await queryRunner.query(
      `CREATE RULE "rl_match_play_events_immutable" AS
         ON UPDATE TO "match_play_events" DO INSTEAD NOTHING`,
    );
  }

  private async createPointLineups(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "match_point_lineups" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "match_id" uuid NOT NULL REFERENCES "matches" ("id") ON DELETE CASCADE,
        "team_id" uuid NOT NULL REFERENCES "teams" ("id") ON DELETE CASCADE,
        "play_id" uuid NOT NULL REFERENCES "match_play_events" ("id")
          ON DELETE CASCADE,
        "point_number" integer NOT NULL,
        "membership_id" uuid NOT NULL REFERENCES "memberships" ("id")
          ON DELETE CASCADE,
        "roster_entry_id" uuid REFERENCES "roster_entries" ("id")
          ON DELETE SET NULL,
        "puller" boolean NOT NULL DEFAULT false,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "ck_lineup_point_number" CHECK ("point_number" > 0)
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_lineups_play_membership"
         ON "match_point_lineups" ("play_id", "membership_id")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_lineups_play_puller"
         ON "match_point_lineups" ("play_id")
        WHERE "puller" = true`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_lineups_match_point"
         ON "match_point_lineups" ("match_id", "point_number",
                                   "membership_id")`,
    );
    await queryRunner.query(
      `CREATE RULE "rl_match_point_lineups_immutable" AS
         ON UPDATE TO "match_point_lineups" DO INSTEAD NOTHING`,
    );
  }

  /**
   * The database-level half of the immutability rule for the point stream. The
   * application refuses these writes first with a typed 409; this guard makes
   * the invariant hold even for a direct SQL session, which is what "finalized
   * matches are immutable" has to mean for published statistics.
   */
  private async createStreamGuards(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE FUNCTION "fn_match_plays_closed_stream"() RETURNS trigger AS $$
      DECLARE current_status text;
      BEGIN
        SELECT "status" INTO current_status FROM "matches"
         WHERE "id" = NEW."match_id";
        IF current_status IN ('finalized', 'abandoned') THEN
          RAISE EXCEPTION
            'match % is closed; its point stream cannot be appended to',
            NEW."match_id";
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
    await queryRunner.query(`
      CREATE TRIGGER "tg_match_plays_closed_stream"
        BEFORE INSERT ON "match_play_events"
        FOR EACH ROW EXECUTE FUNCTION "fn_match_plays_closed_stream"()
    `);
  }
}
