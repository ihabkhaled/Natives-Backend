import { randomUUID } from 'node:crypto';

import { buildDataSourceOptions } from '@app/database/data-source.factory';
import { assertTestDatabase } from '@app/database/test-database.helpers';
import { TypeormUnitOfWorkAdapter } from '@app/database/typeorm-unit-of-work.adapter';
import { MemberDashboardRepository } from '@modules/members/infrastructure/member-dashboard.repository';
import { MembershipContextRepository } from '@modules/members/infrastructure/membership-context.repository';
import { MembershipStatus } from '@modules/members/model/members.enums';
import { PointsDashboardRepository } from '@modules/points/infrastructure/points-dashboard.repository';
import { PracticeDashboardRepository } from '@modules/practices/infrastructure/practice-dashboard.repository';
import { RbacRepository } from '@modules/rbac/infrastructure/rbac.repository';
import { NodeEnv, RbacRole, Role } from '@shared/enums';
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

const NOW = new Date('2026-07-20T12:00:00.000Z');
const MIGRATIONS = [
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
];

function buildDataSource(): DataSource {
  assertTestDatabase(TEST_DB_CONFIG, NodeEnv.Test);
  return new DataSource({
    ...buildDataSourceOptions(TEST_DB_CONFIG),
    migrations: MIGRATIONS,
  });
}

async function connectOrNull(): Promise<DataSource | null> {
  try {
    const dataSource = buildDataSource();
    await dataSource.initialize();
    await dataSource.runMigrations();
    return dataSource;
  } catch {
    return null;
  }
}

const dataSource = await connectOrNull();
const describeIfDb = dataSource ? describe : describe.skip;
const suiteTitle = dataSource
  ? 'Dashboard signals integration (PostgreSQL)'
  : `Dashboard signals integration (SKIPPED: unreachable at ${TEST_DB_CONFIG.host}:${TEST_DB_CONFIG.port} — start docker-compose.test.yml)`;

describeIfDb(suiteTitle, () => {
  const activeDataSource = dataSource;
  if (!activeDataSource) {
    return;
  }
  const unitOfWork = new TypeormUnitOfWorkAdapter(activeDataSource);
  const contexts = new MembershipContextRepository();
  const memberSignals = new MemberDashboardRepository();
  const practiceSignals = new PracticeDashboardRepository();
  const pointsSignals = new PointsDashboardRepository();
  const rbac = new RbacRepository();

  afterAll(async () => {
    let remaining = MIGRATIONS.length;
    while (remaining > 0) {
      await activeDataSource.undoLastMigration();
      remaining -= 1;
    }
    await activeDataSource.destroy();
  });

  async function seedUser(): Promise<string> {
    const id = randomUUID();
    await activeDataSource.query(
      `INSERT INTO "users" ("id", "email", "role", "status") VALUES ($1, $2, $3, 'active')`,
      [id, `user-${id}@example.test`, Role.User],
    );
    return id;
  }

  async function seedTeam(): Promise<string> {
    const id = randomUUID();
    await activeDataSource.query(
      `INSERT INTO "teams" ("id", "slug", "name", "status")
       VALUES ($1, $2, 'Natives', 'active')`,
      [id, `t-${id.slice(0, 8)}`],
    );
    return id;
  }

  async function seedSeason(
    teamId: string,
    startsOn: string,
    endsOn: string,
  ): Promise<string> {
    const id = randomUUID();
    await activeDataSource.query(
      `INSERT INTO "seasons" ("id", "team_id", "slug", "name", "starts_on",
                             "ends_on", "status")
       VALUES ($1, $2, $3, 'Season', $4, $5, 'active')`,
      [id, teamId, `s-${id.slice(0, 8)}`, startsOn, endsOn],
    );
    return id;
  }

  async function seedMembership(
    teamId: string,
    userId: string | null,
    seasonId: string | null,
    status: MembershipStatus,
  ): Promise<string> {
    const id = randomUUID();
    await activeDataSource.query(
      `INSERT INTO "memberships" ("id", "team_id", "season_id", "user_id",
                                 "status", "status_effective_at")
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, teamId, seasonId, userId, status, NOW.toISOString()],
    );
    return id;
  }

  async function seedProfile(
    membershipId: string,
    teamId: string,
    preferredName: string | null,
  ): Promise<void> {
    await activeDataSource.query(
      `INSERT INTO "member_profiles" ("id", "membership_id", "team_id",
                                     "full_name", "preferred_name", "positions")
       VALUES ($1, $2, $3, 'Ahmed Hassan', $4, ARRAY['handler']::text[])`,
      [randomUUID(), membershipId, teamId, preferredName],
    );
  }

  async function seedSession(
    teamId: string,
    status: string,
    startsAt: Date,
  ): Promise<string> {
    const id = randomUUID();
    await activeDataSource.query(
      `INSERT INTO "practice_sessions" ("id", "team_id", "session_type",
                                       "starts_at", "ends_at", "status")
       VALUES ($1, $2, 'training', $3, $4, $5)`,
      [
        id,
        teamId,
        startsAt.toISOString(),
        new Date(startsAt.getTime() + 3_600_000).toISOString(),
        status,
      ],
    );
    return id;
  }

  it('resolves the principal own memberships with team and season labels', async () => {
    const userId = await seedUser();
    const teamId = await seedTeam();
    const seasonId = await seedSeason(teamId, '2026-01-01', '2026-12-31');
    await seedMembership(teamId, userId, seasonId, MembershipStatus.Active);

    const rows = await unitOfWork.runInTransaction(scope =>
      contexts.listForUser(scope, userId, NOW),
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]?.teamId).toBe(teamId);
    expect(rows[0]?.seasonId).toBe(seasonId);
    expect(rows[0]?.seasonName).toBe('Season');
    expect(rows[0]?.status).toBe(MembershipStatus.Active);
  });

  it('falls back to the team current season for a season-less membership', async () => {
    const userId = await seedUser();
    const teamId = await seedTeam();
    await seedSeason(teamId, '2025-01-01', '2025-12-31');
    const current = await seedSeason(teamId, '2026-01-01', '2026-12-31');
    await seedMembership(teamId, userId, null, MembershipStatus.Active);

    const rows = await unitOfWork.runInTransaction(scope =>
      contexts.listForUser(scope, userId, NOW),
    );

    expect(rows[0]?.seasonId).toBe(current);
  });

  it('leaves the season null when the team has none, never a placeholder', async () => {
    const userId = await seedUser();
    const teamId = await seedTeam();
    await seedMembership(teamId, userId, null, MembershipStatus.Suspended);

    const rows = await unitOfWork.runInTransaction(scope =>
      contexts.listForUser(scope, userId, NOW),
    );

    expect(rows[0]?.seasonId).toBeNull();
    expect(rows[0]?.seasonName).toBeNull();
    expect(rows[0]?.status).toBe(MembershipStatus.Suspended);
  });

  it('returns nothing for a user with no membership row', async () => {
    const userId = await seedUser();

    const rows = await unitOfWork.runInTransaction(scope =>
      contexts.listForUser(scope, userId, NOW),
    );

    expect(rows).toEqual([]);
  });

  it('counts the invited roster and scores the viewer profile', async () => {
    const teamId = await seedTeam();
    const userId = await seedUser();
    const membershipId = await seedMembership(
      teamId,
      userId,
      null,
      MembershipStatus.Active,
    );
    await seedProfile(membershipId, teamId, 'Ammar');
    await seedMembership(teamId, null, null, MembershipStatus.Invited);

    const invited = await unitOfWork.runInTransaction(scope =>
      memberSignals.countInvitedMembers(scope, teamId),
    );
    const profile = await unitOfWork.runInTransaction(scope =>
      memberSignals.findProfileCompleteness(scope, teamId, membershipId),
    );

    expect(invited[0]?.count).toBe(1);
    expect(profile[0]?.preferred_name).toBe('Ammar');
  });

  it('lists only future published sessions and flags the viewer RSVP', async () => {
    const teamId = await seedTeam();
    const userId = await seedUser();
    const membershipId = await seedMembership(
      teamId,
      userId,
      null,
      MembershipStatus.Active,
    );
    const upcoming = await seedSession(
      teamId,
      'published',
      new Date('2026-07-25T17:00:00.000Z'),
    );
    await seedSession(teamId, 'draft', new Date('2026-07-26T17:00:00.000Z'));
    await seedSession(
      teamId,
      'published',
      new Date('2026-07-01T17:00:00.000Z'),
    );
    await activeDataSource.query(
      `INSERT INTO "practice_rsvps" ("id", "session_id", "team_id",
                                    "membership_id", "status")
       VALUES ($1, $2, $3, $4, 'going')`,
      [randomUUID(), upcoming, teamId, membershipId],
    );

    const rows = await unitOfWork.runInTransaction(scope =>
      practiceSignals.listUpcomingSessions(scope, teamId, membershipId, NOW),
    );
    const drafts = await unitOfWork.runInTransaction(scope =>
      practiceSignals.countDraftSessions(scope, teamId, NOW),
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe(upcoming);
    expect(rows[0]?.has_rsvp).toBe(true);
    expect(drafts[0]?.count).toBe(1);
  });

  it('ranks the ledger in the database and returns one member standing', async () => {
    const teamId = await seedTeam();
    const leaderId = await seedMembership(
      teamId,
      await seedUser(),
      null,
      MembershipStatus.Active,
    );
    const runnerUpId = await seedMembership(
      teamId,
      await seedUser(),
      null,
      MembershipStatus.Active,
    );
    await activeDataSource.query(
      `INSERT INTO "points_ledger" ("id", "team_id", "membership_id",
              "entry_type", "amount", "source_type", "idempotency_key",
              "effective_on")
       VALUES ($1, $2, $3, 'award', 30, 'manual', $4, '2026-07-01'),
              ($5, $2, $6, 'award', 10, 'manual', $7, '2026-07-01')`,
      [
        randomUUID(),
        teamId,
        leaderId,
        randomUUID(),
        randomUUID(),
        runnerUpId,
        randomUUID(),
      ],
    );

    const rows = await unitOfWork.runInTransaction(scope =>
      pointsSignals.standingFor(scope, teamId, null, runnerUpId),
    );

    expect(rows[0]?.rank).toBe(2);
    expect(rows[0]?.population).toBe(2);
    expect(Number(rows[0]?.total)).toBe(10);
  });

  it('returns no standing row for a member with no ledger history', async () => {
    const teamId = await seedTeam();
    const membershipId = await seedMembership(
      teamId,
      await seedUser(),
      null,
      MembershipStatus.Active,
    );

    const rows = await unitOfWork.runInTransaction(scope =>
      pointsSignals.standingFor(scope, teamId, null, membershipId),
    );

    expect(rows).toEqual([]);
  });

  it('reads the seeded role catalog and one team scoped assignment', async () => {
    const teamId = await seedTeam();
    const userId = await seedUser();
    const role = await activeDataSource.query(
      `SELECT "id" FROM "roles" WHERE "key" = $1`,
      [RbacRole.Coach],
    );
    await activeDataSource.query(
      `INSERT INTO "user_role_assignments" ("id", "user_id", "role_id", "team_id")
       VALUES ($1, $2, $3, $4)`,
      [randomUUID(), userId, role[0].id, teamId],
    );

    const catalog = await unitOfWork.runInTransaction(scope =>
      rbac.listRoleCatalog(scope),
    );
    const assignments = await unitOfWork.runInTransaction(scope =>
      rbac.listActiveTeamAssignments(scope, userId, teamId),
    );

    expect(catalog.length).toBeGreaterThan(0);
    expect(assignments).toHaveLength(1);
    expect(assignments[0]?.roleKey).toBe(RbacRole.Coach);
  });
});
