import { buildDataSourceOptions } from '@app/database/data-source.factory';
import {
  MIGRATIONS_COMPLETED_LOG,
  MIGRATIONS_UP_TO_DATE_LOG,
} from '@app/database/database.constants';
import { DatabaseLifecycleService } from '@app/database/database-lifecycle.service';
import { buildSeeders } from '@app/database/seeds/seed-registry';
import type { AppConfigService } from '@config/app-config.service';
import type { DatabaseConfig } from '@config/config.types';
import type { AppLogger } from '@core/logger';
import { Client } from 'pg';
import { DataSource } from 'typeorm';
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

// This list previously hand-tracked only the first 21 migrations and silently
// fell 29 behind as the schema grew — the lifecycle test then ran a partial
// migration set against a "fresh" database, so any table or column added
// after 1723800000000 (platform-lifecycle) simply never existed for this
// suite. Generated from every file under src/database/migrations; keep it
// exhaustive rather than hand-maintained going forward.
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

const ALL_MIGRATIONS = [
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
  // The persona seeder's v3 demonstration set (practice program + scorekeeper
  // queue) needs competitions and matches, with squads → rosters between them
  // for the matches FK chain.
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
];
const MIGRATION_COUNT = ALL_MIGRATIONS.length;
// Every registered seeder writes exactly one seed_history row on a fresh boot.
const SEEDER_COUNT = 4;
// The admin plus the thirteen demonstration personas the persona seeder
// provisions (twelve team members and the membership-less platform-only one).
const SEEDED_USER_COUNT = 14;

const HOST = process.env['TEST_DB_HOST'] ?? '127.0.0.1';
const PORT = Number(process.env['TEST_DB_PORT'] ?? '55432');
const USER = process.env['TEST_DB_USERNAME'] ?? 'natives_test';
const PASSWORD = process.env['TEST_DB_PASSWORD'] ?? 'natives_test';
const LIFECYCLE_DB = 'natives_lifecycle_test';
const MAINTENANCE_DB = 'postgres';

const LIFECYCLE_CONFIG: DatabaseConfig = {
  url: undefined,
  host: HOST,
  port: PORT,
  username: USER,
  password: PASSWORD,
  name: LIFECYCLE_DB,
  poolMin: 1,
  poolMax: 4,
  connectTimeoutMs: 3000,
  statementTimeoutMs: 10_000,
  ssl: false,
  logging: false,
  migrationsRunOnStart: true,
  seedOnStart: true,
};

const ADMIN_CONFIG = {
  email: 'lifecycle-admin@example.test',
  password: 'runtime-only-password',
  displayName: 'Lifecycle Admin',
};

function buildLogger() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    setContext: vi.fn(),
  };
}

function seeders() {
  return buildSeeders({
    passwordHash: {
      hash: (value: string) => Promise.resolve(`hashed:${value}`),
    },
    loadAdminConfig: () => ADMIN_CONFIG,
    loadPersonasConfig: () => ({ password: 'runtime-only-persona-password' }),
  });
}

function buildService(
  dataSource: DataSource,
  logger: ReturnType<typeof buildLogger>,
) {
  const config = {
    database: LIFECYCLE_CONFIG,
  } as unknown as AppConfigService;
  return new DatabaseLifecycleService(
    dataSource,
    config,
    logger as unknown as AppLogger,
  );
}

function buildLifecycleDataSource(): DataSource {
  return new DataSource({
    ...buildDataSourceOptions(LIFECYCLE_CONFIG),
    migrations: ALL_MIGRATIONS,
  });
}

async function connectMaintenanceOrNull(): Promise<Client | null> {
  const client = new Client({
    host: HOST,
    port: PORT,
    user: USER,
    password: PASSWORD,
    database: MAINTENANCE_DB,
    connectionTimeoutMillis: 3000,
  });
  try {
    await client.connect();
    return client;
  } catch {
    return null;
  }
}

const maintenance = await connectMaintenanceOrNull();
const describeIfDb = maintenance ? describe : describe.skip;
const suiteTitle = maintenance
  ? 'Database lifecycle integration'
  : `Database lifecycle integration (SKIPPED: unreachable at ${HOST}:${PORT} — start docker-compose.test.yml)`;

describeIfDb(suiteTitle, () => {
  const client = maintenance;
  if (!client) {
    return;
  }
  const active: DataSource[] = [];

  function track(dataSource: DataSource): DataSource {
    active.push(dataSource);
    return dataSource;
  }

  beforeEach(async () => {
    await client.query(
      `DROP DATABASE IF EXISTS "${LIFECYCLE_DB}" WITH (FORCE)`,
    );
    await client.query(`CREATE DATABASE "${LIFECYCLE_DB}"`);
  });

  afterEach(async () => {
    for (const dataSource of active.splice(0)) {
      if (dataSource.isInitialized) {
        await dataSource.destroy();
      }
    }
  });

  afterAll(async () => {
    await client.query(
      `DROP DATABASE IF EXISTS "${LIFECYCLE_DB}" WITH (FORCE)`,
    );
    await client.end();
  });

  it('applies every migration and seeds once on an empty database', async () => {
    const dataSource = track(buildLifecycleDataSource());
    await dataSource.initialize();

    await buildService(dataSource, buildLogger()).run(seeders());

    const migrations = await dataSource.query(
      'SELECT COUNT(*)::int AS count FROM "migrations"',
    );
    expect(migrations[0].count).toBe(MIGRATION_COUNT);
    const seedRows = await dataSource.query(
      'SELECT "seed_key", "applied_by" FROM "seed_history" ORDER BY "seed_key"',
    );
    expect(seedRows).toEqual([
      { seed_key: 'admin', applied_by: 'boot' },
      { seed_key: 'personas', applied_by: 'boot' },
      { seed_key: 'roster-ultimate-natives', applied_by: 'boot' },
      { seed_key: 'team-ultimate-natives', applied_by: 'boot' },
    ]);
    const users = await dataSource.query(
      `SELECT COUNT(*)::int AS count FROM "users" WHERE lower("email") = lower($1)`,
      [ADMIN_CONFIG.email],
    );
    expect(users[0].count).toBe(1);
  });

  it('applies nothing on a second run and never re-seeds', async () => {
    const dataSource = track(buildLifecycleDataSource());
    await dataSource.initialize();
    await buildService(dataSource, buildLogger()).run(seeders());
    const before = await dataSource.query(
      `SELECT "applied_at" FROM "seed_history" WHERE "seed_key" = $1`,
      ['admin'],
    );

    const secondLogger = buildLogger();
    await buildService(dataSource, secondLogger).run(seeders());

    const migrations = await dataSource.query(
      'SELECT COUNT(*)::int AS count FROM "migrations"',
    );
    expect(migrations[0].count).toBe(MIGRATION_COUNT);
    const after = await dataSource.query(
      `SELECT "applied_at" FROM "seed_history" WHERE "seed_key" = $1`,
      ['admin'],
    );
    expect(after[0].applied_at).toEqual(before[0].applied_at);
    const users = await dataSource.query(
      'SELECT COUNT(*)::int AS count FROM "users"',
    );
    expect(users[0].count).toBe(SEEDED_USER_COUNT);
    expect(secondLogger.info).toHaveBeenCalledWith(MIGRATIONS_UP_TO_DATE_LOG);
  });

  it('serializes two concurrent instances so exactly one migrates', async () => {
    const first = track(buildLifecycleDataSource());
    const second = track(buildLifecycleDataSource());
    await first.initialize();
    await second.initialize();
    const firstLogger = buildLogger();
    const secondLogger = buildLogger();

    await Promise.all([
      buildService(first, firstLogger).run(seeders()),
      buildService(second, secondLogger).run(seeders()),
    ]);

    const migrations = await first.query(
      'SELECT COUNT(*)::int AS count FROM "migrations"',
    );
    expect(migrations[0].count).toBe(MIGRATION_COUNT);
    const admins = await first.query(
      'SELECT COUNT(*)::int AS count FROM "users"',
    );
    expect(admins[0].count).toBe(SEEDED_USER_COUNT);
    const seedRows = await first.query(
      'SELECT COUNT(*)::int AS count FROM "seed_history"',
    );
    expect(seedRows[0].count).toBe(SEEDER_COUNT);
    const teams = await first.query(
      'SELECT COUNT(*)::int AS count FROM "teams"',
    );
    expect(teams[0].count).toBe(1);
    const migratedLoggers = [firstLogger, secondLogger].filter(logger =>
      logger.info.mock.calls.some(call => call[0] === MIGRATIONS_COMPLETED_LOG),
    );
    expect(migratedLoggers).toHaveLength(1);
  });
});
