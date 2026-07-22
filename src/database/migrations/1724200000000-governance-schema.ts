import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Team rules, acknowledgements, discipline, and governance (UN-602, UN-603).
 * Seven additive tables; it changes no existing table and grants no new
 * permission (rules.* / discipline.* / governance.* are already seeded):
 *
 *   - team_rules              versioned, effective-dated rule documents with an
 *                             audience and an archive state. A rule is never
 *                             edited: a new version supersedes the old one, and
 *                             an acknowledgement always cites the version it
 *                             accepted.
 *   - rule_acknowledgements   one member's acceptance of one rule VERSION.
 *   - discipline_cases        a highly-restricted corrective-action record: a
 *                             fact summary, evidence references, private notes,
 *                             a status, an action, a due date, the member's
 *                             response, an appeal, a resolution, the reviewer
 *                             for separation-of-duties, and a retention deadline.
 *                             Discipline never touches public rank.
 *   - governance_positions    configurable team titles (captain, coach, board,
 *                             finance, social, spirit) — titles only, no app
 *                             permission is granted by holding one.
 *   - governance_appointments a term of one appointee in one position with an
 *                             acting flag and a history (start/end).
 *   - governance_meetings     meetings with agenda, visibility, minute-approval
 *                             state, and a decision register.
 *   - governance_tasks        operational tasks with owner, due date, priority,
 *                             status, and a dependency pointer.
 *
 * Conventions: UUID PKs, timestamptz UTC, snake_case, check constraints
 * mirroring the enums, optimistic record_version, bounded indexes. Reversible.
 */
export class GovernanceSchema1724200000000 implements MigrationInterface {
  name = 'GovernanceSchema1724200000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await this.createRules(queryRunner);
    await this.createAcknowledgements(queryRunner);
    await this.createDisciplineCases(queryRunner);
    await this.createPositions(queryRunner);
    await this.createAppointments(queryRunner);
    await this.createMeetings(queryRunner);
    await this.createTasks(queryRunner);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "governance_tasks"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "governance_meetings"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "governance_appointments"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "governance_positions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "discipline_cases"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "rule_acknowledgements"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "team_rules"`);
  }

  private async createRules(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "team_rules" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "team_id" uuid NOT NULL REFERENCES "teams" ("id") ON DELETE CASCADE,
        "rule_key" text NOT NULL,
        "version" integer NOT NULL,
        "category" text NOT NULL,
        "title" text NOT NULL,
        "body" text NOT NULL,
        "audience" text NOT NULL DEFAULT 'team',
        "requires_acknowledgement" boolean NOT NULL DEFAULT true,
        "effective_from" timestamptz NOT NULL,
        "status" text NOT NULL DEFAULT 'active',
        "owner_user_id" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "created_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "archived_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "ck_rule_category" CHECK ("category" IN
          ('conduct', 'attendance', 'safety', 'finance', 'spirit', 'general')),
        CONSTRAINT "ck_rule_audience" CHECK ("audience" IN
          ('team', 'players', 'staff', 'public')),
        CONSTRAINT "ck_rule_status" CHECK ("status" IN ('active', 'archived')),
        CONSTRAINT "ck_rule_version" CHECK ("version" > 0)
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_rules_key_version"
         ON "team_rules" ("team_id", "rule_key", "version")`,
    );
    await queryRunner.query(
      `CREATE RULE "rl_team_rules_immutable" AS
         ON UPDATE TO "team_rules" DO INSTEAD NOTHING`,
    );
  }

  private async createAcknowledgements(
    queryRunner: QueryRunner,
  ): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "rule_acknowledgements" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "team_id" uuid NOT NULL REFERENCES "teams" ("id") ON DELETE CASCADE,
        "rule_id" uuid NOT NULL REFERENCES "team_rules" ("id")
          ON DELETE CASCADE,
        "membership_id" uuid NOT NULL REFERENCES "memberships" ("id")
          ON DELETE CASCADE,
        "rule_version" integer NOT NULL,
        "acknowledged_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "ux_ack_rule_member" UNIQUE ("rule_id", "membership_id")
      )
    `);
  }

  private async createDisciplineCases(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "discipline_cases" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "team_id" uuid NOT NULL REFERENCES "teams" ("id") ON DELETE CASCADE,
        "membership_id" uuid NOT NULL REFERENCES "memberships" ("id")
          ON DELETE CASCADE,
        "rule_id" uuid REFERENCES "team_rules" ("id") ON DELETE SET NULL,
        "severity" text NOT NULL DEFAULT 'concern',
        "fact_summary" text NOT NULL,
        "evidence_reference" text,
        "private_notes" text,
        "status" text NOT NULL DEFAULT 'open',
        "action" text NOT NULL DEFAULT 'none',
        "due_date" date,
        "member_response" text,
        "appeal_reason" text,
        "resolution" text,
        "opened_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "reviewed_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "resolved_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "record_version" integer NOT NULL DEFAULT 1,
        "responded_at" timestamptz,
        "reviewed_at" timestamptz,
        "appealed_at" timestamptz,
        "resolved_at" timestamptz,
        "expunged_at" timestamptz,
        "retention_expires_at" timestamptz NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "ck_case_severity" CHECK ("severity" IN
          ('concern', 'minor', 'major', 'critical')),
        CONSTRAINT "ck_case_status" CHECK ("status" IN
          ('open', 'notified', 'acknowledged', 'responded', 'under_review',
           'resolved', 'appealed', 'expunged')),
        CONSTRAINT "ck_case_action" CHECK ("action" IN
          ('none', 'warning', 'suspension', 'probation', 'expulsion',
           'corrective_plan')),
        CONSTRAINT "ck_case_reviewer_sod" CHECK
          ("reviewed_by" IS NULL OR "reviewed_by" <> "opened_by")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_discipline_scope"
         ON "discipline_cases" ("team_id", "status", "created_at" DESC, "id")`,
    );
  }

  private async createPositions(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "governance_positions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "team_id" uuid NOT NULL REFERENCES "teams" ("id") ON DELETE CASCADE,
        "position_key" text NOT NULL,
        "title" text NOT NULL,
        "responsibilities" text,
        "status" text NOT NULL DEFAULT 'active',
        "created_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "ck_position_status" CHECK ("status" IN
          ('active', 'archived'))
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_positions_team_key"
         ON "governance_positions" ("team_id", "position_key")`,
    );
  }

  private async createAppointments(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "governance_appointments" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "team_id" uuid NOT NULL REFERENCES "teams" ("id") ON DELETE CASCADE,
        "position_id" uuid NOT NULL REFERENCES "governance_positions" ("id")
          ON DELETE CASCADE,
        "membership_id" uuid NOT NULL REFERENCES "memberships" ("id")
          ON DELETE CASCADE,
        "acting" boolean NOT NULL DEFAULT false,
        "starts_on" date NOT NULL,
        "ends_on" date,
        "status" text NOT NULL DEFAULT 'active',
        "created_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "ck_appointment_status" CHECK ("status" IN
          ('active', 'ended')),
        CONSTRAINT "ck_appointment_dates" CHECK
          ("ends_on" IS NULL OR "ends_on" >= "starts_on")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_appointments_position"
         ON "governance_appointments" ("position_id", "starts_on" DESC, "id")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_appointments_active_position"
         ON "governance_appointments" ("position_id")
         WHERE "status" = 'active' AND "acting" = false`,
    );
  }

  private async createMeetings(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "governance_meetings" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "team_id" uuid NOT NULL REFERENCES "teams" ("id") ON DELETE CASCADE,
        "title" text NOT NULL,
        "scheduled_at" timestamptz NOT NULL,
        "agenda" text,
        "minutes" text,
        "decisions" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "visibility" text NOT NULL DEFAULT 'staff',
        "status" text NOT NULL DEFAULT 'scheduled',
        "recurrence" text NOT NULL DEFAULT 'none',
        "record_version" integer NOT NULL DEFAULT 1,
        "created_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "minutes_approved_by" uuid REFERENCES "users" ("id")
          ON DELETE SET NULL,
        "minutes_approved_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "ck_meeting_visibility" CHECK ("visibility" IN
          ('public', 'team', 'staff', 'board')),
        CONSTRAINT "ck_meeting_status" CHECK ("status" IN
          ('scheduled', 'held', 'minuted', 'approved', 'cancelled')),
        CONSTRAINT "ck_meeting_recurrence" CHECK ("recurrence" IN
          ('none', 'weekly', 'monthly', 'quarterly'))
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_meetings_scope"
         ON "governance_meetings" ("team_id", "scheduled_at" DESC, "id")`,
    );
  }

  private async createTasks(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "governance_tasks" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "team_id" uuid NOT NULL REFERENCES "teams" ("id") ON DELETE CASCADE,
        "meeting_id" uuid REFERENCES "governance_meetings" ("id")
          ON DELETE SET NULL,
        "title" text NOT NULL,
        "description" text,
        "owner_membership_id" uuid REFERENCES "memberships" ("id")
          ON DELETE SET NULL,
        "due_date" date,
        "priority" text NOT NULL DEFAULT 'normal',
        "status" text NOT NULL DEFAULT 'open',
        "depends_on_task_id" uuid REFERENCES "governance_tasks" ("id")
          ON DELETE SET NULL,
        "record_version" integer NOT NULL DEFAULT 1,
        "created_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "completed_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "ck_task_priority" CHECK ("priority" IN
          ('low', 'normal', 'high', 'urgent')),
        CONSTRAINT "ck_task_status" CHECK ("status" IN
          ('open', 'in_progress', 'blocked', 'completed', 'cancelled'))
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_tasks_scope"
         ON "governance_tasks" ("team_id", "status", "due_date", "id")`,
    );
  }
}
