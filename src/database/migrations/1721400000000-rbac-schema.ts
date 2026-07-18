import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * RBAC schema. Creates the permission catalog, role bundles, the role-permission
 * join, scoped user role assignments, and the singleton policy-version row used
 * for cache invalidation. Then idempotently seeds the full canonical permission
 * catalog (88 permissions) and the default system role bundles (MEMBER, COACH,
 * TEAM_ADMIN, SCOREKEEPER, ANALYST) derived from 11-SCHEMAS/rbac.permissions.yaml.
 *
 * The seed data is inlined (not imported) so the migration loads with zero
 * module-resolution dependencies in every environment, and so it stays an
 * immutable snapshot decoupled from evolving application constants. The typed
 * catalog lives in @shared/constants (permission-catalog + role-bundles) and is
 * kept consistent with this seed by the catalog/bundle unit tests and the RBAC
 * integration test (which asserts 88 permissions + 5 roles are seeded).
 *
 * Conventions: UUID PKs, timestamptz UTC, snake_case, created_at/updated_at,
 * optimistic version and revoked_at soft-revoke on assignments, a partial unique
 * index for one active assignment per user+role+team+season scope. Seeds use ON
 * CONFLICT DO NOTHING so re-running is a no-op. Fully reversible: down drops
 * exactly what up created, in dependency order.
 *
 * Deferred (documented): a per-user grant/deny permission_overrides table and
 * team/season foreign keys - team_id/season_id are currently plain nullable UUID
 * scope columns; membership linkage is refined in prompt 104.
 */

// [key, area, description]
const PERMISSION_SEED: readonly (readonly [string, string, string])[] = [
  ['team.read', 'team', 'View a team'],
  ['team.settings.read', 'team', 'View team settings'],
  ['team.settings.manage', 'team', 'Change team settings'],
  ['season.manage', 'team', 'Manage seasons'],
  ['venue.manage', 'team', 'Manage venues'],
  ['member.list', 'members', 'List team members'],
  [
    'member.profile.read.public',
    'members',
    'Read public member profile fields',
  ],
  [
    'member.profile.read.coach',
    'members',
    'Read coach-restricted member profile fields',
  ],
  [
    'member.profile.read.admin',
    'members',
    'Read admin-restricted member profile fields',
  ],
  ['member.profile.update.self', 'members', 'Update own member profile'],
  ['member.invite', 'members', 'Invite new members'],
  [
    'member.lifecycle.manage',
    'members',
    'Manage member lifecycle (activate/suspend/leave)',
  ],
  ['member.roles.manage', 'members', 'Assign and revoke member roles'],
  ['member.aliases.manage', 'members', 'Manage member aliases'],
  ['practice.read', 'practices', 'View practices'],
  ['practice.manage', 'practices', 'Create and manage practices'],
  ['practice.rsvp.self', 'practices', 'RSVP to own practices'],
  ['practice.rsvp.override', 'practices', 'Override another member RSVP'],
  ['attendance.read.self', 'practices', 'View own attendance'],
  ['attendance.read.team', 'practices', 'View team attendance'],
  ['attendance.record', 'practices', 'Record attendance'],
  ['attendance.finalize', 'practices', 'Finalize attendance'],
  ['attendance.correct', 'practices', 'Correct finalized attendance'],
  ['drill.manage', 'practices', 'Manage drills'],
  [
    'assessment.read.self.published',
    'performance',
    'Read own published assessments',
  ],
  ['assessment.read.team', 'performance', 'Read team assessments'],
  ['assessment.create', 'performance', 'Create assessments'],
  ['assessment.review', 'performance', 'Review assessments'],
  ['assessment.publish', 'performance', 'Publish assessments'],
  ['assessment.correct', 'performance', 'Correct published assessments'],
  ['feedback.read.self', 'performance', 'Read own feedback'],
  ['feedback.manage', 'performance', 'Manage feedback'],
  ['measurement.record', 'performance', 'Record measurements'],
  ['analytics.read.self', 'performance', 'View own analytics'],
  ['analytics.read.team', 'performance', 'View team analytics'],
  ['activity.submit.self', 'training', 'Submit own external activity'],
  ['activity.read.self', 'training', 'Read own external activity'],
  ['activity.review', 'training', 'Review external activity'],
  ['activity.correct', 'training', 'Correct external activity'],
  ['evidence.read.review', 'training', 'Read evidence during review'],
  ['points.read.self', 'training', 'View own points'],
  ['points.read.team', 'training', 'View team points'],
  ['points.adjust', 'training', 'Adjust points ledger'],
  ['leaderboard.read', 'training', 'View leaderboards'],
  ['points.rules.manage', 'training', 'Manage points rules'],
  ['competition.read', 'competition', 'View competitions'],
  ['competition.manage', 'competition', 'Manage competitions'],
  ['squad.read', 'competition', 'View squads'],
  ['squad.manage', 'competition', 'Manage squads'],
  ['squad.override_eligibility', 'competition', 'Override squad eligibility'],
  ['roster.read', 'competition', 'View rosters'],
  ['roster.manage', 'competition', 'Manage rosters'],
  ['roster.lock', 'competition', 'Lock rosters'],
  ['match.read', 'match', 'View matches'],
  ['match.manage', 'match', 'Manage matches'],
  ['match.score', 'match', 'Score a match'],
  ['match.finalize', 'match', 'Finalize a match'],
  ['match.correct', 'match', 'Correct a finalized match'],
  ['match.stats.read', 'match', 'View match statistics'],
  ['match.analysis.read.self', 'match', 'Read own match analysis'],
  ['match.analysis.read.team', 'match', 'Read team match analysis'],
  ['match.analysis.manage', 'match', 'Manage match analysis'],
  ['tryout.public.register', 'tryouts', 'Register for a tryout publicly'],
  ['tryout.candidate.read.self', 'tryouts', 'Read own tryout candidate record'],
  ['tryout.manage', 'tryouts', 'Manage tryouts'],
  ['tryout.contacts.read', 'tryouts', 'Read tryout contact details'],
  ['tryout.readiness.read', 'tryouts', 'Read tryout readiness data'],
  ['tryout.evaluate', 'tryouts', 'Evaluate tryout candidates'],
  ['tryout.decide', 'tryouts', 'Decide tryout outcomes'],
  ['tryout.convert', 'tryouts', 'Convert a candidate to a member'],
  ['governance.read', 'governance', 'View governance records'],
  ['governance.manage', 'governance', 'Manage governance records'],
  ['rules.read', 'governance', 'View rules'],
  ['rules.manage', 'governance', 'Manage rules'],
  ['discipline.read', 'governance', 'View discipline records'],
  ['discipline.manage', 'governance', 'Manage discipline records'],
  ['jersey.read', 'governance', 'View jersey reservations'],
  ['jersey.manage', 'governance', 'Manage jersey reservations'],
  ['notification.read.self', 'operations', 'Read own notifications'],
  [
    'notification.preferences.self',
    'operations',
    'Manage own notification preferences',
  ],
  ['report.generate', 'operations', 'Generate reports'],
  ['report.read', 'operations', 'Read reports'],
  ['import.manage', 'operations', 'Manage data imports'],
  ['import.signoff', 'operations', 'Sign off on data imports'],
  ['audit.read', 'operations', 'Read the audit log'],
  ['jobs.manage', 'operations', 'Manage background jobs'],
  ['data_quality.manage', 'operations', 'Manage data quality'],
  ['security.admin', 'operations', 'System-wide security administration'],
];

// [key, displayName, description]
const ROLE_SEED: readonly (readonly [string, string, string])[] = [
  ['MEMBER', 'Member', 'Baseline participating member'],
  ['COACH', 'Coach', 'Coaching staff for a team'],
  ['TEAM_ADMIN', 'Team administrator', 'Full administration of a team'],
  ['SCOREKEEPER', 'Scorekeeper', 'Records live match scores'],
  ['ANALYST', 'Analyst', 'Read-only analytics and reporting'],
];

// [roleKey, permissionKeys]
const BUNDLE_SEED: readonly (readonly [string, readonly string[]])[] = [
  [
    'MEMBER',
    [
      'team.read',
      'member.profile.read.public',
      'member.profile.update.self',
      'practice.read',
      'practice.rsvp.self',
      'attendance.read.self',
      'assessment.read.self.published',
      'feedback.read.self',
      'activity.submit.self',
      'activity.read.self',
      'points.read.self',
      'leaderboard.read',
      'competition.read',
      'squad.read',
      'roster.read',
      'match.read',
      'match.stats.read',
      'match.analysis.read.self',
      'notification.read.self',
      'notification.preferences.self',
    ],
  ],
  [
    'COACH',
    [
      'team.read',
      'member.profile.read.public',
      'member.profile.update.self',
      'practice.read',
      'practice.rsvp.self',
      'attendance.read.self',
      'assessment.read.self.published',
      'feedback.read.self',
      'activity.submit.self',
      'activity.read.self',
      'points.read.self',
      'leaderboard.read',
      'competition.read',
      'squad.read',
      'roster.read',
      'match.read',
      'match.stats.read',
      'match.analysis.read.self',
      'notification.read.self',
      'notification.preferences.self',
      'member.list',
      'member.profile.read.coach',
      'practice.manage',
      'practice.rsvp.override',
      'attendance.read.team',
      'attendance.record',
      'attendance.finalize',
      'drill.manage',
      'assessment.read.team',
      'assessment.create',
      'assessment.review',
      'assessment.publish',
      'feedback.manage',
      'measurement.record',
      'analytics.read.team',
      'activity.review',
      'evidence.read.review',
      'points.read.team',
      'squad.manage',
      'roster.manage',
      'match.manage',
      'match.analysis.read.team',
      'match.analysis.manage',
      'tryout.manage',
      'tryout.evaluate',
    ],
  ],
  [
    'TEAM_ADMIN',
    [
      'team.read',
      'member.profile.read.public',
      'member.profile.update.self',
      'practice.read',
      'practice.rsvp.self',
      'attendance.read.self',
      'assessment.read.self.published',
      'feedback.read.self',
      'activity.submit.self',
      'activity.read.self',
      'points.read.self',
      'leaderboard.read',
      'competition.read',
      'squad.read',
      'roster.read',
      'match.read',
      'match.stats.read',
      'match.analysis.read.self',
      'notification.read.self',
      'notification.preferences.self',
      'member.list',
      'member.profile.read.coach',
      'practice.manage',
      'practice.rsvp.override',
      'attendance.read.team',
      'attendance.record',
      'attendance.finalize',
      'drill.manage',
      'assessment.read.team',
      'assessment.create',
      'assessment.review',
      'assessment.publish',
      'feedback.manage',
      'measurement.record',
      'analytics.read.team',
      'activity.review',
      'evidence.read.review',
      'points.read.team',
      'squad.manage',
      'roster.manage',
      'match.manage',
      'match.analysis.read.team',
      'match.analysis.manage',
      'tryout.manage',
      'tryout.evaluate',
      'team.settings.read',
      'team.settings.manage',
      'season.manage',
      'venue.manage',
      'member.invite',
      'member.lifecycle.manage',
      'member.roles.manage',
      'member.aliases.manage',
      'attendance.correct',
      'assessment.correct',
      'activity.correct',
      'points.adjust',
      'points.rules.manage',
      'squad.override_eligibility',
      'roster.lock',
      'match.finalize',
      'match.correct',
      'tryout.contacts.read',
      'tryout.readiness.read',
      'tryout.decide',
      'tryout.convert',
      'governance.manage',
      'rules.manage',
      'discipline.read',
      'discipline.manage',
      'jersey.manage',
      'report.generate',
      'report.read',
      'import.manage',
      'import.signoff',
      'audit.read',
      'jobs.manage',
      'data_quality.manage',
    ],
  ],
  [
    'SCOREKEEPER',
    [
      'team.read',
      'competition.read',
      'roster.read',
      'match.read',
      'match.score',
      'match.stats.read',
    ],
  ],
  [
    'ANALYST',
    [
      'team.read',
      'member.list',
      'practice.read',
      'attendance.read.team',
      'analytics.read.team',
      'points.read.team',
      'leaderboard.read',
      'competition.read',
      'roster.read',
      'match.read',
      'match.stats.read',
      'report.generate',
      'report.read',
    ],
  ],
];

export class RbacSchema1721400000000 implements MigrationInterface {
  name = 'RbacSchema1721400000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await this.createTables(queryRunner);
    await this.seedPermissions(queryRunner);
    await this.seedRoles(queryRunner);
    await this.seedRolePermissions(queryRunner);
    await this.seedPolicyVersion(queryRunner);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "rbac_policy_version"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "user_role_assignments"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "role_permissions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "roles"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "permissions"`);
  }

  private async createTables(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "permissions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "key" text NOT NULL,
        "area" text NOT NULL,
        "description" text NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_permissions_key" ON "permissions" ("key")`,
    );

    await queryRunner.query(`
      CREATE TABLE "roles" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "key" text NOT NULL,
        "display_name" text NOT NULL,
        "description" text NOT NULL,
        "is_system" boolean NOT NULL DEFAULT false,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_roles_key" ON "roles" ("key")`,
    );

    await queryRunner.query(`
      CREATE TABLE "role_permissions" (
        "role_id" uuid NOT NULL REFERENCES "roles" ("id") ON DELETE CASCADE,
        "permission_id" uuid NOT NULL REFERENCES "permissions" ("id") ON DELETE CASCADE,
        PRIMARY KEY ("role_id", "permission_id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_role_permissions_permission" ON "role_permissions" ("permission_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "user_role_assignments" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
        "role_id" uuid NOT NULL REFERENCES "roles" ("id") ON DELETE RESTRICT,
        "team_id" uuid,
        "season_id" uuid,
        "effective_from" timestamptz NOT NULL DEFAULT now(),
        "effective_to" timestamptz,
        "granted_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        "revoked_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "version" integer NOT NULL DEFAULT 1
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_user_role_assignment_scope"
         ON "user_role_assignments" (
           "user_id",
           "role_id",
           COALESCE("team_id", '00000000-0000-0000-0000-000000000000'::uuid),
           COALESCE("season_id", '00000000-0000-0000-0000-000000000000'::uuid)
         )
        WHERE "revoked_at" IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_user_role_assignments_active_user"
         ON "user_role_assignments" ("user_id") WHERE "revoked_at" IS NULL`,
    );

    await queryRunner.query(`
      CREATE TABLE "rbac_policy_version" (
        "singleton" boolean PRIMARY KEY DEFAULT true,
        "version" integer NOT NULL DEFAULT 1,
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "ck_rbac_policy_version_singleton" CHECK ("singleton")
      )
    `);
  }

  private async seedPermissions(queryRunner: QueryRunner): Promise<void> {
    for (const [key, area, description] of PERMISSION_SEED) {
      await queryRunner.query(
        `INSERT INTO "permissions" ("key", "area", "description")
         VALUES ($1, $2, $3) ON CONFLICT ("key") DO NOTHING`,
        [key, area, description],
      );
    }
  }

  private async seedRoles(queryRunner: QueryRunner): Promise<void> {
    for (const [key, displayName, description] of ROLE_SEED) {
      await queryRunner.query(
        `INSERT INTO "roles" ("key", "display_name", "description", "is_system")
         VALUES ($1, $2, $3, true) ON CONFLICT ("key") DO NOTHING`,
        [key, displayName, description],
      );
    }
  }

  private async seedRolePermissions(queryRunner: QueryRunner): Promise<void> {
    for (const [roleKey, permissions] of BUNDLE_SEED) {
      for (const permission of permissions) {
        await queryRunner.query(
          `INSERT INTO "role_permissions" ("role_id", "permission_id")
           SELECT r."id", p."id" FROM "roles" r, "permissions" p
            WHERE r."key" = $1 AND p."key" = $2
           ON CONFLICT DO NOTHING`,
          [roleKey, permission],
        );
      }
    }
  }

  private async seedPolicyVersion(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `INSERT INTO "rbac_policy_version" ("singleton", "version")
       VALUES (true, 1) ON CONFLICT ("singleton") DO NOTHING`,
    );
  }
}
