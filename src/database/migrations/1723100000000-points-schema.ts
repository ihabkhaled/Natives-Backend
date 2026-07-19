import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Append-only points system (UN-402). Four additive tables plus one append-only
 * database guard — it changes no existing table:
 *
 *   - points_rules       named, versioned point-value rule sets moving
 *                        draft → approved → published → retired. Per-category
 *                        values with optional daily cap / cooldown live in a jsonb
 *                        array. A partial unique index allows at most one PUBLISHED
 *                        rule per (team scope, rule key). The legacy external-
 *                        training values are seeded as a DRAFT candidate (team_id
 *                        NULL) — never activated automatically.
 *   - points_ledger      the immutable, append-only ledger. Every entry cites its
 *                        type, amount (signed; reversals are negative rows),
 *                        source, rule version, reason, effective date, actor, and a
 *                        UNIQUE idempotency_key (one award per submission per rule).
 *                        A BEFORE UPDATE OR DELETE trigger refuses every mutation,
 *                        so an amount is never edited — corrections are new rows.
 *   - badge_definitions  tier thresholds. >100 Trophy / >200 Globe / >450 Dragon
 *                        are seeded as `needs_approval` CANDIDATES and the broken
 *                        `#REF!` >649 tier as `disabled`; only an ACTIVE definition
 *                        is ever awarded, so unresolved badge data is never guessed.
 *   - player_badges      badges a member has earned, unique per (membership,
 *                        definition) so crossing a threshold twice never doubles it.
 *
 * Conventions: UUID PKs via gen_random_uuid(), timestamptz UTC, snake_case, check
 * constraints mirroring the enums, bounded covering indexes, idempotent seeds via
 * ON CONFLICT. Fully reversible: down drops the guard, the tables, then the guard
 * function, in dependency order. Proven from empty by the integration + e2e suites.
 */

const GLOBAL = '00000000-0000-0000-0000-000000000000';
const LEGACY_RULE_ID = '40200000-0000-4000-9000-000000000001';
const TROPHY_ID = '40200000-0000-4000-9000-0000000000b1';
const GLOBE_ID = '40200000-0000-4000-9000-0000000000b2';
const DRAGON_ID = '40200000-0000-4000-9000-0000000000b3';
const BROKEN_ID = '40200000-0000-4000-9000-0000000000b4';

// [id, badgeKey, name, description, threshold, status]
const BADGE_SEED: readonly (readonly [
  string,
  string,
  string,
  string,
  number,
  string,
])[] = [
  [
    TROPHY_ID,
    'trophy',
    'Trophy',
    'Legacy tier candidate awarded above 100 points. Seeded needs_approval; an administrator must approve it before it is awarded.',
    100,
    'needs_approval',
  ],
  [
    GLOBE_ID,
    'globe',
    'Globe',
    'Legacy tier candidate awarded above 200 points. Seeded needs_approval.',
    200,
    'needs_approval',
  ],
  [
    DRAGON_ID,
    'dragon',
    'Dragon',
    'Legacy tier candidate awarded above 450 points. Seeded needs_approval.',
    450,
    'needs_approval',
  ],
  [
    BROKEN_ID,
    'broken_tier',
    'Broken tier (#REF!)',
    'Broken legacy tier whose threshold traces to a #REF! spreadsheet error (>649). Disabled until the correct threshold is decided; never awarded.',
    649,
    'disabled',
  ],
];

export class PointsSchema1723100000000 implements MigrationInterface {
  name = 'PointsSchema1723100000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await this.createRules(queryRunner);
    await this.createLedger(queryRunner);
    await this.createBadgeDefinitions(queryRunner);
    await this.createPlayerBadges(queryRunner);
    await this.createAppendOnlyGuard(queryRunner);
    await this.seedRule(queryRunner);
    await this.seedBadges(queryRunner);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "player_badges"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "badge_definitions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "points_ledger"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "points_rules"`);
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS "guard_points_ledger_append_only"()`,
    );
  }

  private async createRules(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "points_rules" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "team_id" uuid REFERENCES "teams" ("id") ON DELETE CASCADE,
        "season_id" uuid REFERENCES "seasons" ("id") ON DELETE SET NULL,
        "rule_key" text NOT NULL,
        "version" integer NOT NULL,
        "name" text NOT NULL,
        "description" text,
        "status" text NOT NULL DEFAULT 'draft',
        "point_entries" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "effective_from" date,
        "effective_to" date,
        "record_version" integer NOT NULL DEFAULT 1,
        "created_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "published_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "published_at" timestamptz,
        "retired_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "ck_points_rule_status" CHECK ("status" IN
          ('draft', 'approved', 'published', 'retired')),
        CONSTRAINT "ck_points_rule_versions"
          CHECK ("version" > 0 AND "record_version" > 0),
        CONSTRAINT "ck_points_rule_entries"
          CHECK (jsonb_typeof("point_entries") = 'array'),
        CONSTRAINT "ck_points_rule_effective"
          CHECK ("effective_from" IS NULL OR "effective_to" IS NULL
                 OR "effective_from" <= "effective_to")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_points_rule_scope_version"
         ON "points_rules"
          (COALESCE("team_id", '${GLOBAL}'::uuid), "rule_key", "version")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_points_rule_published"
         ON "points_rules"
          (COALESCE("team_id", '${GLOBAL}'::uuid), "rule_key")
        WHERE "status" = 'published'`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_points_rules_scope_list"
         ON "points_rules" ("team_id", "rule_key", "version" DESC, "id")`,
    );
  }

  private async createLedger(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "points_ledger" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "team_id" uuid NOT NULL REFERENCES "teams" ("id") ON DELETE CASCADE,
        "season_id" uuid REFERENCES "seasons" ("id") ON DELETE SET NULL,
        "membership_id" uuid NOT NULL REFERENCES "memberships" ("id")
          ON DELETE CASCADE,
        "entry_type" text NOT NULL,
        "amount" numeric NOT NULL,
        "source_type" text NOT NULL,
        "source_id" uuid,
        "rule_id" uuid REFERENCES "points_rules" ("id") ON DELETE SET NULL,
        "rule_version" integer,
        "activity_category" text,
        "reason" text,
        "reason_key" text,
        "reverses_entry_id" uuid REFERENCES "points_ledger" ("id")
          ON DELETE SET NULL,
        "idempotency_key" text NOT NULL,
        "effective_on" date NOT NULL,
        "actor_user_id" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "ck_points_ledger_entry_type" CHECK ("entry_type" IN
          ('award', 'reversal', 'manual_adjustment', 'import_adjustment',
           'expiry')),
        CONSTRAINT "ck_points_ledger_source_type" CHECK ("source_type" IN
          ('activity_submission', 'manual', 'import', 'system'))
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_points_ledger_idempotency"
         ON "points_ledger" ("idempotency_key")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_points_ledger_member"
         ON "points_ledger" ("team_id", "membership_id", "created_at" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_points_ledger_award_facts"
         ON "points_ledger"
          ("membership_id", "activity_category", "entry_type", "effective_on")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_points_ledger_source"
         ON "points_ledger" ("source_id", "entry_type")`,
    );
  }

  private async createBadgeDefinitions(
    queryRunner: QueryRunner,
  ): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "badge_definitions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "team_id" uuid REFERENCES "teams" ("id") ON DELETE CASCADE,
        "badge_key" text NOT NULL,
        "name" text NOT NULL,
        "description" text,
        "threshold" integer NOT NULL,
        "status" text NOT NULL DEFAULT 'candidate',
        "icon" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "ck_badge_definition_status" CHECK ("status" IN
          ('candidate', 'needs_approval', 'active', 'disabled')),
        CONSTRAINT "ck_badge_definition_threshold" CHECK ("threshold" >= 0)
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_badge_definition_scope_key"
         ON "badge_definitions"
          (COALESCE("team_id", '${GLOBAL}'::uuid), "badge_key")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_badge_definitions_active"
         ON "badge_definitions" ("status", "threshold", "id")`,
    );
  }

  private async createPlayerBadges(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "player_badges" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "team_id" uuid NOT NULL REFERENCES "teams" ("id") ON DELETE CASCADE,
        "membership_id" uuid NOT NULL REFERENCES "memberships" ("id")
          ON DELETE CASCADE,
        "badge_definition_id" uuid NOT NULL REFERENCES "badge_definitions" ("id")
          ON DELETE CASCADE,
        "badge_key" text NOT NULL,
        "threshold" integer NOT NULL,
        "points_at_award" numeric NOT NULL,
        "awarded_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "awarded_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "ck_player_badge_threshold" CHECK ("threshold" >= 0),
        CONSTRAINT "ux_player_badge_once"
          UNIQUE ("membership_id", "badge_definition_id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_player_badges_member"
         ON "player_badges" ("team_id", "membership_id", "awarded_at")`,
    );
  }

  private async createAppendOnlyGuard(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE FUNCTION "guard_points_ledger_append_only"()
      RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        RAISE EXCEPTION
          'points_ledger is append-only: % is not permitted', TG_OP;
      END
      $$
    `);
    await queryRunner.query(`
      CREATE TRIGGER "trg_points_ledger_append_only"
      BEFORE UPDATE OR DELETE ON "points_ledger"
      FOR EACH ROW EXECUTE FUNCTION "guard_points_ledger_append_only"()
    `);
  }

  private async seedRule(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `INSERT INTO "points_rules"
        ("id", "team_id", "season_id", "rule_key", "version", "name",
         "description", "status", "point_entries")
       VALUES ($1, NULL, NULL, 'external_training', 1,
               'External training point candidates',
               'Legacy external-training values (Gym 2, Running 2, Throwing 4, Pickup 2, Another Sport 1, Team Drills 2, Rules Quiz 2). Seeded as a DRAFT candidate — never activated automatically; an administrator must approve and publish it.',
               'draft', $2::jsonb)
       ON CONFLICT DO NOTHING`,
      [
        LEGACY_RULE_ID,
        JSON.stringify([
          {
            activityCategory: 'gym',
            points: 2,
            dailyCap: 1,
            cooldownDays: null,
          },
          {
            activityCategory: 'running',
            points: 2,
            dailyCap: 1,
            cooldownDays: null,
          },
          {
            activityCategory: 'throwing',
            points: 4,
            dailyCap: 1,
            cooldownDays: null,
          },
          {
            activityCategory: 'pickup',
            points: 2,
            dailyCap: 1,
            cooldownDays: null,
          },
          {
            activityCategory: 'other_sport',
            points: 1,
            dailyCap: 1,
            cooldownDays: null,
          },
          {
            activityCategory: 'team_drills',
            points: 2,
            dailyCap: 1,
            cooldownDays: null,
          },
          {
            activityCategory: 'rules_quiz',
            points: 2,
            dailyCap: 1,
            cooldownDays: null,
          },
        ]),
      ],
    );
  }

  private async seedBadges(queryRunner: QueryRunner): Promise<void> {
    for (const [
      id,
      badgeKey,
      name,
      description,
      threshold,
      status,
    ] of BADGE_SEED) {
      await queryRunner.query(
        `INSERT INTO "badge_definitions"
          ("id", "team_id", "badge_key", "name", "description", "threshold",
           "status")
         VALUES ($1, NULL, $2, $3, $4, $5, $6)
         ON CONFLICT DO NOTHING`,
        [id, badgeKey, name, description, threshold, status],
      );
    }
  }
}
