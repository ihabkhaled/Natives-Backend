import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Match lifecycle, live scoreboard, caps, timeouts, and corrections (UN-503).
 * Four additive tables plus two guards — it changes no existing table and grants
 * no new permission (match.read / match.manage / match.score / match.finalize /
 * match.correct are already seeded and bundled by the RBAC baseline):
 *
 *   - match_rulesets   the NAMED, VERSIONED scoring rule set: game-to, win-by,
 *                      soft cap (minutes + increment), hard cap, time cap,
 *                      halftime total, timeout allowance, and period count. A
 *                      NULL cap means the rule DOES NOT APPLY and is never read
 *                      as zero. A published version is never edited — a new
 *                      version is inserted — so a historical match stays
 *                      explainable under exactly the rules it was played under.
 *   - matches          one authoritative match per fixture, moving scheduled →
 *                      ready → live ⇄ paused/halftime → completed → finalized,
 *                      with abandoned as the terminal off-ramp. `our_score` /
 *                      `opponent_score` are a PROJECTION of the accepted point
 *                      events, and `stream_version` is the authoritative sequence
 *                      concurrent scoring devices are guarded against.
 *   - match_events     the append-only stream: points, timeouts, period marks,
 *                      cap notices, and compensating voids. Every row carries the
 *                      CLIENT operation id and a hash of its payload, uniquely
 *                      constrained per match — an offline scorekeeper replaying
 *                      the same operation produces exactly one score change, and
 *                      the same id with a different payload is a hard conflict.
 *                      An ON UPDATE DO INSTEAD NOTHING rule makes a recorded fact
 *                      unrewritable at the database level, so a mistake is undone
 *                      by APPENDING a compensating `void` event — voided-ness is
 *                      derived from that link, never stamped onto history.
 *   - match_revisions  the immutable correction trail. Finalizing, reopening, and
 *                      correcting each append exactly one row carrying the score
 *                      before and after, so a conflicting final score is always a
 *                      visible, attributable delta and is never silently merged.
 *
 * Two database-level guards enforce immutability where the application cannot be
 * the only line of defence:
 *   - `tg_matches_finalized_immutable` rejects ANY update to a finalized match
 *     that does not bump `revision` — that is, every in-place edit. Only the
 *     audited reopen path bumps the revision.
 *   - `tg_match_events_closed_stream` rejects appending to the stream of a
 *     finalized or abandoned match.
 *
 * Conventions: UUID PKs via gen_random_uuid(), timestamptz UTC, snake_case, check
 * constraints mirroring the enums, optimistic record_version, partial unique
 * indexes for the single live match per fixture and the single active ruleset
 * version. Fully reversible: down drops the triggers, functions, rules, and
 * tables in dependency order. Proven from empty by the integration + e2e suites.
 */
export class MatchesSchema1723600000000 implements MigrationInterface {
  name = 'MatchesSchema1723600000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await this.createRulesets(queryRunner);
    await this.createMatches(queryRunner);
    await this.createEvents(queryRunner);
    await this.createRevisions(queryRunner);
    await this.createImmutabilityGuards(queryRunner);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS "tg_match_events_closed_stream"
         ON "match_events"`,
    );
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS "tg_matches_finalized_immutable" ON "matches"`,
    );
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS "fn_match_events_closed_stream"()`,
    );
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS "fn_matches_finalized_immutable"()`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "match_revisions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "match_events"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "matches"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "match_rulesets"`);
  }

  private async createRulesets(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "match_rulesets" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "team_id" uuid NOT NULL REFERENCES "teams" ("id") ON DELETE CASCADE,
        "season_id" uuid REFERENCES "seasons" ("id") ON DELETE CASCADE,
        "ruleset_key" text NOT NULL,
        "ruleset_version" integer NOT NULL DEFAULT 1,
        "name" text NOT NULL,
        "game_to" integer NOT NULL,
        "win_by" integer NOT NULL DEFAULT 1,
        "hard_cap" integer,
        "soft_cap_minutes" integer,
        "soft_cap_plus" integer,
        "time_cap_minutes" integer,
        "halftime_at" integer,
        "timeouts_per_team" integer NOT NULL DEFAULT 2,
        "timeouts_per_period" integer,
        "periods" integer NOT NULL DEFAULT 2,
        "status" text NOT NULL DEFAULT 'active',
        "notes" text,
        "created_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "ck_ruleset_status" CHECK ("status" IN
          ('draft', 'active', 'archived')),
        CONSTRAINT "ck_ruleset_version" CHECK ("ruleset_version" > 0),
        CONSTRAINT "ck_ruleset_game_to" CHECK ("game_to" > 0),
        CONSTRAINT "ck_ruleset_win_by" CHECK ("win_by" > 0),
        CONSTRAINT "ck_ruleset_hard_cap" CHECK
          ("hard_cap" IS NULL OR "hard_cap" >= "game_to"),
        CONSTRAINT "ck_ruleset_soft_cap" CHECK
          ("soft_cap_minutes" IS NULL OR "soft_cap_minutes" > 0),
        CONSTRAINT "ck_ruleset_soft_plus" CHECK
          ("soft_cap_plus" IS NULL OR "soft_cap_plus" > 0),
        CONSTRAINT "ck_ruleset_time_cap" CHECK
          ("time_cap_minutes" IS NULL OR "time_cap_minutes" > 0),
        CONSTRAINT "ck_ruleset_halftime" CHECK
          ("halftime_at" IS NULL OR "halftime_at" > 0),
        CONSTRAINT "ck_ruleset_timeouts" CHECK ("timeouts_per_team" >= 0),
        CONSTRAINT "ck_ruleset_timeouts_period" CHECK
          ("timeouts_per_period" IS NULL OR "timeouts_per_period" >= 0),
        CONSTRAINT "ck_ruleset_periods" CHECK ("periods" > 0)
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_rulesets_team_key_version"
         ON "match_rulesets" ("team_id", "ruleset_key", "ruleset_version")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_rulesets_team_key_active"
         ON "match_rulesets" ("team_id", "ruleset_key")
        WHERE "status" = 'active'`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_rulesets_team_status"
         ON "match_rulesets" ("team_id", "status", "ruleset_key",
                              "ruleset_version")`,
    );
  }

  private async createMatches(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "matches" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "team_id" uuid NOT NULL REFERENCES "teams" ("id") ON DELETE CASCADE,
        "season_id" uuid NOT NULL REFERENCES "seasons" ("id") ON DELETE CASCADE,
        "competition_id" uuid NOT NULL REFERENCES "competitions" ("id")
          ON DELETE CASCADE,
        "fixture_id" uuid NOT NULL REFERENCES "fixtures" ("id")
          ON DELETE CASCADE,
        "roster_id" uuid REFERENCES "rosters" ("id") ON DELETE SET NULL,
        "ruleset_id" uuid NOT NULL REFERENCES "match_rulesets" ("id")
          ON DELETE RESTRICT,
        "status" text NOT NULL DEFAULT 'scheduled',
        "home_away" text NOT NULL DEFAULT 'home',
        "our_score" integer NOT NULL DEFAULT 0,
        "opponent_score" integer NOT NULL DEFAULT 0,
        "period" integer NOT NULL DEFAULT 1,
        "stream_version" integer NOT NULL DEFAULT 0,
        "record_version" integer NOT NULL DEFAULT 1,
        "revision" integer NOT NULL DEFAULT 1,
        "result" text NOT NULL DEFAULT 'undecided',
        "cap_applied" text NOT NULL DEFAULT 'none',
        "engine_version" text NOT NULL DEFAULT 'match-scoring-v1',
        "supersedes_match_id" uuid REFERENCES "matches" ("id")
          ON DELETE SET NULL,
        "reopen_reason" text,
        "reopened_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "reopened_at" timestamptz,
        "created_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "started_at" timestamptz,
        "paused_at" timestamptz,
        "resumed_at" timestamptz,
        "halftime_at" timestamptz,
        "completed_at" timestamptz,
        "finalized_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "finalized_at" timestamptz,
        "abandoned_at" timestamptz,
        "abandon_reason" text,
        "notes" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "ck_match_status" CHECK ("status" IN
          ('scheduled', 'ready', 'live', 'paused', 'halftime', 'completed',
           'finalized', 'abandoned')),
        CONSTRAINT "ck_match_home_away" CHECK ("home_away" IN
          ('home', 'away', 'neutral')),
        CONSTRAINT "ck_match_result" CHECK ("result" IN
          ('win', 'loss', 'draw', 'undecided')),
        CONSTRAINT "ck_match_cap" CHECK ("cap_applied" IN
          ('none', 'soft', 'hard', 'time')),
        CONSTRAINT "ck_match_scores" CHECK
          ("our_score" >= 0 AND "opponent_score" >= 0),
        CONSTRAINT "ck_match_period" CHECK ("period" > 0),
        CONSTRAINT "ck_match_stream_version" CHECK ("stream_version" >= 0),
        CONSTRAINT "ck_match_record_version" CHECK ("record_version" > 0),
        CONSTRAINT "ck_match_revision" CHECK ("revision" > 0),
        CONSTRAINT "ck_match_reopen_reason" CHECK
          ("reopened_at" IS NULL OR "reopen_reason" IS NOT NULL),
        CONSTRAINT "ck_match_abandon_reason" CHECK
          ("status" <> 'abandoned' OR "abandon_reason" IS NOT NULL),
        CONSTRAINT "ck_match_finalized_stamp" CHECK
          ("status" <> 'finalized' OR "finalized_at" IS NOT NULL)
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_matches_fixture_live"
         ON "matches" ("fixture_id")
        WHERE "status" <> 'abandoned'`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_matches_team_scope"
         ON "matches" ("team_id", "season_id", "status", "created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_matches_competition"
         ON "matches" ("competition_id", "status", "created_at", "id")`,
    );
  }

  private async createEvents(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "match_events" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "match_id" uuid NOT NULL REFERENCES "matches" ("id") ON DELETE CASCADE,
        "team_id" uuid NOT NULL REFERENCES "teams" ("id") ON DELETE CASCADE,
        "sequence" integer NOT NULL,
        "operation_id" text NOT NULL,
        "request_hash" text NOT NULL,
        "event_type" text NOT NULL,
        "scoring_side" text,
        "points" integer,
        "our_score_after" integer NOT NULL,
        "opponent_score_after" integer NOT NULL,
        "period" integer NOT NULL DEFAULT 1,
        "scorer_membership_id" uuid REFERENCES "memberships" ("id")
          ON DELETE SET NULL,
        "assist_membership_id" uuid REFERENCES "memberships" ("id")
          ON DELETE SET NULL,
        "voids_event_id" uuid REFERENCES "match_events" ("id")
          ON DELETE SET NULL,
        "void_reason" text,
        "recorded_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "occurred_at" timestamptz,
        "recorded_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "ck_event_type" CHECK ("event_type" IN
          ('point', 'timeout', 'period_start', 'period_end', 'cap_applied',
           'void')),
        CONSTRAINT "ck_event_side" CHECK ("scoring_side" IS NULL OR
          "scoring_side" IN ('us', 'them')),
        CONSTRAINT "ck_event_points" CHECK ("points" IS NULL OR "points" > 0),
        CONSTRAINT "ck_event_point_side" CHECK
          ("event_type" <> 'point' OR "scoring_side" IS NOT NULL),
        CONSTRAINT "ck_event_scores" CHECK
          ("our_score_after" >= 0 AND "opponent_score_after" >= 0),
        CONSTRAINT "ck_event_sequence" CHECK ("sequence" > 0),
        CONSTRAINT "ck_event_period" CHECK ("period" > 0),
        CONSTRAINT "ck_event_void_target" CHECK
          ("event_type" <> 'void' OR ("voids_event_id" IS NOT NULL
                                      AND "void_reason" IS NOT NULL))
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_events_match_operation"
         ON "match_events" ("match_id", "operation_id")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_events_void_target"
         ON "match_events" ("voids_event_id")
        WHERE "voids_event_id" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_events_match_sequence"
         ON "match_events" ("match_id", "sequence")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_events_match_period"
         ON "match_events" ("match_id", "period", "event_type", "scoring_side")`,
    );
  }

  private async createRevisions(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "match_revisions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "match_id" uuid NOT NULL REFERENCES "matches" ("id") ON DELETE CASCADE,
        "team_id" uuid NOT NULL REFERENCES "teams" ("id") ON DELETE CASCADE,
        "sequence" integer NOT NULL,
        "revision" integer NOT NULL,
        "action" text NOT NULL,
        "reason" text NOT NULL,
        "from_status" text NOT NULL,
        "to_status" text NOT NULL,
        "our_score_before" integer NOT NULL,
        "opponent_score_before" integer NOT NULL,
        "our_score_after" integer NOT NULL,
        "opponent_score_after" integer NOT NULL,
        "stream_version" integer NOT NULL,
        "actor_user_id" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "ck_revision_action" CHECK ("action" IN
          ('finalized', 'reopened', 'corrected')),
        CONSTRAINT "ck_revision_number" CHECK ("revision" > 0),
        CONSTRAINT "ck_revision_sequence" CHECK ("sequence" > 0),
        CONSTRAINT "ck_revision_scores" CHECK
          ("our_score_before" >= 0 AND "opponent_score_before" >= 0
           AND "our_score_after" >= 0 AND "opponent_score_after" >= 0),
        CONSTRAINT "ck_revision_stream" CHECK ("stream_version" >= 0)
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_revisions_match_revision_action"
         ON "match_revisions" ("match_id", "revision", "action")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_revisions_match_sequence"
         ON "match_revisions" ("match_id", "sequence")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_revisions_match"
         ON "match_revisions" ("match_id", "sequence", "id")`,
    );
    await queryRunner.query(
      `CREATE RULE "rl_match_revisions_immutable" AS
         ON UPDATE TO "match_revisions" DO INSTEAD NOTHING`,
    );
  }

  /**
   * The database-level halves of the immutability rule. The application refuses
   * these writes first with a typed 409; these guards make the invariant hold
   * even for a direct SQL session, which is exactly what "finalized matches are
   * immutable" has to mean for published results.
   */
  private async createImmutabilityGuards(
    queryRunner: QueryRunner,
  ): Promise<void> {
    await queryRunner.query(`
      CREATE FUNCTION "fn_matches_finalized_immutable"() RETURNS trigger AS $$
      BEGIN
        IF OLD."status" = 'finalized' AND NEW."revision" = OLD."revision" THEN
          RAISE EXCEPTION
            'match % is finalized and immutable; reopen it to correct it',
            OLD."id";
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
    await queryRunner.query(`
      CREATE TRIGGER "tg_matches_finalized_immutable"
        BEFORE UPDATE ON "matches"
        FOR EACH ROW EXECUTE FUNCTION "fn_matches_finalized_immutable"()
    `);
    await queryRunner.query(`
      CREATE FUNCTION "fn_match_events_closed_stream"() RETURNS trigger AS $$
      DECLARE current_status text;
      BEGIN
        SELECT "status" INTO current_status FROM "matches"
         WHERE "id" = NEW."match_id";
        IF current_status IN ('finalized', 'abandoned') THEN
          RAISE EXCEPTION
            'match % is closed; its score stream cannot be appended to',
            NEW."match_id";
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
    await queryRunner.query(`
      CREATE TRIGGER "tg_match_events_closed_stream"
        BEFORE INSERT ON "match_events"
        FOR EACH ROW EXECUTE FUNCTION "fn_match_events_closed_stream"()
    `);
    await queryRunner.query(
      `CREATE RULE "rl_match_events_immutable" AS
         ON UPDATE TO "match_events" DO INSTEAD NOTHING`,
    );
  }
}
