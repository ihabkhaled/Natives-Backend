import { randomUUID } from 'node:crypto';

import { buildDataSourceOptions } from '@app/database/data-source.factory';
import { assertTestDatabase } from '@app/database/test-database.helpers';
import { TypeormUnitOfWorkAdapter } from '@app/database/typeorm-unit-of-work.adapter';
import type { AuthUserIdentity } from '@core/auth';
import type { ClockPort } from '@core/clock/clock.port';
import type { AppLogger } from '@core/logger';
import { RbacPermissionResolverService } from '@modules/rbac/application/rbac-permission-resolver.service';
import { RbacRepository } from '@modules/rbac/infrastructure/rbac.repository';
import type { RbacRoleRecord } from '@modules/rbac/model/rbac.types';
import { NodeEnv, Permission, RbacRole, Role } from '@shared/enums';
import { DataSource } from 'typeorm';
import { afterAll, describe, expect, it } from 'vitest';

import { BaselineSchema1721200000000 } from '../../src/database/migrations/1721200000000-baseline-schema';
import { IdentitySchema1721300000000 } from '../../src/database/migrations/1721300000000-identity-schema';
import { RbacSchema1721400000000 } from '../../src/database/migrations/1721400000000-rbac-schema';
import { TeamsSchema1721500000000 } from '../../src/database/migrations/1721500000000-teams-schema';
import { MembersSchema1721600000000 } from '../../src/database/migrations/1721600000000-members-schema';
import { PlatformSchema1721700000000 } from '../../src/database/migrations/1721700000000-platform-schema';
import { PracticesSchema1721800000000 } from '../../src/database/migrations/1721800000000-practices-schema';
import { PracticeRsvpSchema1721900000000 } from '../../src/database/migrations/1721900000000-practice-rsvp-schema';
import { AttendanceSchema1722000000000 } from '../../src/database/migrations/1722000000000-attendance-schema';
import { PracticeAgendasSchema1722100000000 } from '../../src/database/migrations/1722100000000-practice-agendas-schema';
import { PracticeRemindersCalendarSchema1722200000000 } from '../../src/database/migrations/1722200000000-practice-reminders-calendar-schema';
import { AssessmentCatalogSchema1722300000000 } from '../../src/database/migrations/1722300000000-assessment-catalog-schema';
import { PlayerAssessmentSchema1722400000000 } from '../../src/database/migrations/1722400000000-player-assessment-schema';
import { DevelopmentSchema1722500000000 } from '../../src/database/migrations/1722500000000-development-schema';
import { SeedHistorySchema1722600000000 } from '../../src/database/migrations/1722600000000-seed-history-schema';
import { ScoringSchema1722700000000 } from '../../src/database/migrations/1722700000000-scoring-schema';
import { MeasurementsSchema1722800000000 } from '../../src/database/migrations/1722800000000-measurements-schema';
import { ActivitiesSchema1722900000000 } from '../../src/database/migrations/1722900000000-activities-schema';
import { ActivityReviewSchema1723000000000 } from '../../src/database/migrations/1723000000000-activity-review-schema';
import { PointsSchema1723100000000 } from '../../src/database/migrations/1723100000000-points-schema';
import { LeaderboardIndexes1723200000000 } from '../../src/database/migrations/1723200000000-leaderboard-indexes';
import { CompetitionsSchema1723300000000 } from '../../src/database/migrations/1723300000000-competitions-schema';
import { SquadsSchema1723400000000 } from '../../src/database/migrations/1723400000000-squads-schema';
import { RostersSchema1723500000000 } from '../../src/database/migrations/1723500000000-rosters-schema';
import { MatchesSchema1723600000000 } from '../../src/database/migrations/1723600000000-matches-schema';
import { MatchLineupsSchema1723700000000 } from '../../src/database/migrations/1723700000000-match-lineups-schema';
import { PlatformLifecycleSchema1723800000000 } from '../../src/database/migrations/1723800000000-platform-lifecycle-schema';
import { VideoAnalysisSchema1723900000000 } from '../../src/database/migrations/1723900000000-video-analysis-schema';
import { StandingsSchema1724000000000 } from '../../src/database/migrations/1724000000000-standings-schema';
import { TryoutsSchema1724100000000 } from '../../src/database/migrations/1724100000000-tryouts-schema';
import { GovernanceSchema1724200000000 } from '../../src/database/migrations/1724200000000-governance-schema';
import { JerseysSchema1724300000000 } from '../../src/database/migrations/1724300000000-jerseys-schema';
import { AnalyticsSchema1724400000000 } from '../../src/database/migrations/1724400000000-analytics-schema';
import { ReportsSchema1724500000000 } from '../../src/database/migrations/1724500000000-reports-schema';
import { MigrationSchema1724600000000 } from '../../src/database/migrations/1724600000000-migration-schema';
import { DataQualitySchema1724700000000 } from '../../src/database/migrations/1724700000000-data-quality-schema';
import { InvitationsTeamScope1724800000000 } from '../../src/database/migrations/1724800000000-invitations-team-scope';
import { TeamAdminMatchScore1724900000000 } from '../../src/database/migrations/1724900000000-team-admin-match-score';
import { RbacRoleCatalogMetadata1725000000000 } from '../../src/database/migrations/1725000000000-rbac-role-catalog-metadata';
import { InvitationTeamRole1725100000000 } from '../../src/database/migrations/1725100000000-invitation-team-role';
import { JobHeartbeats1725200000000 } from '../../src/database/migrations/1725200000000-job-heartbeats';
import { OutboxDeadLetterTimestamp1725300000000 } from '../../src/database/migrations/1725300000000-outbox-dead-letter-timestamp';
import { GovernanceJerseyReadGrants1725400000000 } from '../../src/database/migrations/1725400000000-governance-jersey-read-grants';
import { AchievementRejectionReason1725500000000 } from '../../src/database/migrations/1725500000000-achievement-rejection-reason';
import { SignupReview1725600000000 } from '../../src/database/migrations/1725600000000-signup-review';
import { TeamStaffAssignments1725700000000 } from '../../src/database/migrations/1725700000000-team-staff-assignments';
import { TeamPublicProfile1725900000000 } from '../../src/database/migrations/1725900000000-team-public-profile';
import { MemberJerseyDisplay1726000000000 } from '../../src/database/migrations/1726000000000-member-jersey-display';
import { JerseyNumberAsText1726100000000 } from '../../src/database/migrations/1726100000000-jersey-number-as-text';
import { RosterJerseyTextAndNameFix1726200000000 } from '../../src/database/migrations/1726200000000-roster-jersey-text-and-name-fix';

const TEST_DB_CONFIG = {
  url: process.env['TEST_DATABASE_URL'],
  host: process.env['TEST_DB_HOST'] ?? '127.0.0.1',
  port: Number(process.env['TEST_DB_PORT'] ?? '55432'),
  username: process.env['TEST_DB_USERNAME'] ?? 'natives_test',
  password: process.env['TEST_DB_PASSWORD'] ?? 'natives_test',
  name: process.env['TEST_DB_NAME'] ?? 'natives_test',
  poolMin: 1,
  poolMax: 4,
  connectTimeoutMs: 3000,
  statementTimeoutMs: 5000,
  ssl: false,
  logging: false,
};

const NOW = new Date('2026-06-01T12:00:00.000Z');
const TEAM_A = randomUUID();
const TEAM_B = randomUUID();

function buildDataSource(): DataSource {
  assertTestDatabase(TEST_DB_CONFIG, NodeEnv.Test);
  return new DataSource({
    ...buildDataSourceOptions(TEST_DB_CONFIG),
    migrations: [
      BaselineSchema1721200000000,
      IdentitySchema1721300000000,
      RbacSchema1721400000000,
      TeamsSchema1721500000000,
      MembersSchema1721600000000,
      PlatformSchema1721700000000,
      PracticesSchema1721800000000,
      PracticeRsvpSchema1721900000000,
      AttendanceSchema1722000000000,
      PracticeAgendasSchema1722100000000,
      PracticeRemindersCalendarSchema1722200000000,
      AssessmentCatalogSchema1722300000000,
      PlayerAssessmentSchema1722400000000,
      DevelopmentSchema1722500000000,
      SeedHistorySchema1722600000000,
      ScoringSchema1722700000000,
      MeasurementsSchema1722800000000,
      ActivitiesSchema1722900000000,
      ActivityReviewSchema1723000000000,
      PointsSchema1723100000000,
      LeaderboardIndexes1723200000000,
      CompetitionsSchema1723300000000,
      SquadsSchema1723400000000,
      RostersSchema1723500000000,
      MatchesSchema1723600000000,
      MatchLineupsSchema1723700000000,
      PlatformLifecycleSchema1723800000000,
      VideoAnalysisSchema1723900000000,
      StandingsSchema1724000000000,
      TryoutsSchema1724100000000,
      GovernanceSchema1724200000000,
      JerseysSchema1724300000000,
      AnalyticsSchema1724400000000,
      ReportsSchema1724500000000,
      MigrationSchema1724600000000,
      DataQualitySchema1724700000000,
      InvitationsTeamScope1724800000000,
      TeamAdminMatchScore1724900000000,
      RbacRoleCatalogMetadata1725000000000,
      InvitationTeamRole1725100000000,
      JobHeartbeats1725200000000,
      OutboxDeadLetterTimestamp1725300000000,
      GovernanceJerseyReadGrants1725400000000,
      AchievementRejectionReason1725500000000,
      SignupReview1725600000000,
      TeamStaffAssignments1725700000000,
      TeamPublicProfile1725900000000,
      MemberJerseyDisplay1726000000000,
      JerseyNumberAsText1726100000000,
      RosterJerseyTextAndNameFix1726200000000,
    ],
  });
}

async function connectOrNull(): Promise<DataSource | null> {
  try {
    const dataSource = buildDataSource();
    await dataSource.initialize();
    return dataSource;
  } catch {
    return null;
  }
}

function buildResolver(dataSource: DataSource): {
  readonly resolver: RbacPermissionResolverService;
  readonly repository: RbacRepository;
  readonly unitOfWork: TypeormUnitOfWorkAdapter;
} {
  const unitOfWork = new TypeormUnitOfWorkAdapter(dataSource);
  const repository = new RbacRepository();
  const clock: ClockPort = { now: () => NOW, uptime: () => 0 };
  const noop = (): undefined => undefined;
  const logger = {
    setContext: noop,
    debug: noop,
    info: noop,
    warn: noop,
    error: noop,
  } as unknown as AppLogger;
  const resolver = new RbacPermissionResolverService(
    clock,
    unitOfWork,
    repository,
    logger,
  );
  return { resolver, repository, unitOfWork };
}

async function seedUser(
  dataSource: DataSource,
  status: string,
): Promise<string> {
  const id = randomUUID();
  await dataSource.query(
    `INSERT INTO "users" ("id", "email", "role", "status") VALUES ($1, $2, $3, $4)`,
    [id, `user-${id}@example.test`, Role.User, status],
  );
  return id;
}

const dataSource = await connectOrNull();
const describeIfDb = dataSource ? describe : describe.skip;
const suiteTitle = dataSource
  ? 'RBAC integration (PostgreSQL)'
  : `RBAC integration (SKIPPED: unreachable at ${TEST_DB_CONFIG.host}:${TEST_DB_CONFIG.port} — start docker-compose.test.yml)`;

describeIfDb(suiteTitle, () => {
  const activeDataSource = dataSource;
  if (!activeDataSource) {
    return;
  }

  afterAll(async () => {
    await activeDataSource.undoLastMigration();
    await activeDataSource.undoLastMigration();
    await activeDataSource.undoLastMigration();
    await activeDataSource.undoLastMigration();
    await activeDataSource.destroy();
  });

  async function assign(
    userId: string,
    role: RbacRoleRecord,
    teamId: string | null,
  ): Promise<void> {
    const { repository, unitOfWork } = buildResolver(activeDataSource);
    await unitOfWork.runInTransaction(async scope => {
      await repository.insertAssignment(scope, {
        id: randomUUID(),
        userId,
        roleId: role.id,
        roleKey: role.key,
        teamId,
        seasonId: null,
        effectiveFrom: NOW,
        effectiveTo: null,
        grantedBy: null,
      });
      await repository.bumpPolicyVersion(scope, NOW);
    });
  }

  async function findRole(role: RbacRole): Promise<RbacRoleRecord> {
    const { repository, unitOfWork } = buildResolver(activeDataSource);
    const record = await unitOfWork.runInTransaction(scope =>
      repository.findRoleByKey(scope, role),
    );
    if (record === null) {
      throw new Error(`seeded role ${role} not found`);
    }
    return record;
  }

  it('migrates from empty and seeds the catalog and bundles, reversibly', async () => {
    await activeDataSource.runMigrations();

    const permissions = await activeDataSource.query(
      `SELECT COUNT(*)::int AS count FROM "permissions"`,
    );
    const roles = await activeDataSource.query(
      `SELECT COUNT(*)::int AS count FROM "roles"`,
    );
    const rolePermissions = await activeDataSource.query(
      `SELECT COUNT(*)::int AS count FROM "role_permissions"`,
    );
    const policy = await activeDataSource.query(
      `SELECT "version" FROM "rbac_policy_version"`,
    );
    expect(permissions[0].count).toBe(88);
    expect(roles[0].count).toBe(5);
    expect(rolePermissions[0].count).toBeGreaterThan(0);
    expect(policy[0].version).toBe(1);

    // Every seeded role starts team-scoped and assignable (catalog metadata).
    const metadata = await activeDataSource.query(
      `SELECT COUNT(*)::int AS count FROM "roles"
        WHERE "scope" = 'team' AND "is_assignable" = true`,
    );
    expect(metadata[0].count).toBe(5);

    await activeDataSource.undoLastMigration();
    await activeDataSource.undoLastMigration();
    const dropped = await activeDataSource.query(
      `SELECT to_regclass('public.permissions') AS relation`,
    );
    expect(dropped[0].relation).toBeNull();

    await activeDataSource.runMigrations();
  });

  it('resolves scoped permissions per team and denies cross-team', async () => {
    const userId = await seedUser(activeDataSource, 'active');
    const coach = await findRole(RbacRole.Coach);
    await assign(userId, coach, TEAM_A);

    const { resolver } = buildResolver(activeDataSource);
    const principal: AuthUserIdentity = {
      userId,
      email: 'coach@example.test',
      roles: [],
    };

    const inTeamA = await resolver.resolve(principal, { teamId: TEAM_A });
    const inTeamB = await resolver.resolve(principal, { teamId: TEAM_B });

    expect(inTeamA.has(Permission.PracticeManage)).toBe(true);
    expect(inTeamB.has(Permission.PracticeManage)).toBe(false);
  });

  it('invalidates a stale cache after an assignment change', async () => {
    const userId = await seedUser(activeDataSource, 'active');
    const coach = await findRole(RbacRole.Coach);
    const teamAdmin = await findRole(RbacRole.TeamAdmin);
    await assign(userId, coach, TEAM_A);

    const { resolver } = buildResolver(activeDataSource);
    const principal: AuthUserIdentity = {
      userId,
      email: 'coach@example.test',
      roles: [],
    };

    const before = await resolver.resolve(principal, { teamId: TEAM_A });
    expect(before.has(Permission.MemberRolesManage)).toBe(false);

    // A new assignment bumps the policy version, invalidating the cache.
    await assign(userId, teamAdmin, TEAM_A);

    const after = await resolver.resolve(principal, { teamId: TEAM_A });
    expect(after.has(Permission.MemberRolesManage)).toBe(true);
  });

  it('denies all permissions for an inactive principal', async () => {
    const userId = await seedUser(activeDataSource, 'suspended');
    const coach = await findRole(RbacRole.Coach);
    await assign(userId, coach, TEAM_A);

    const { resolver } = buildResolver(activeDataSource);
    const granted = await resolver.resolve(
      { userId, email: 'x@example.test', roles: [Role.Admin] },
      { teamId: TEAM_A },
    );

    expect(granted.size).toBe(0);
  });
});
