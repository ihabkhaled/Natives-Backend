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
import { CompetitionsSchema1723300000000 } from '../../src/database/migrations/1723300000000-competitions-schema';
import { SquadsSchema1723400000000 } from '../../src/database/migrations/1723400000000-squads-schema';
import { RostersSchema1723500000000 } from '../../src/database/migrations/1723500000000-rosters-schema';
import { MatchesSchema1723600000000 } from '../../src/database/migrations/1723600000000-matches-schema';
import { MatchLineupsSchema1723700000000 } from '../../src/database/migrations/1723700000000-match-lineups-schema';
import { PlatformLifecycleSchema1723800000000 } from '../../src/database/migrations/1723800000000-platform-lifecycle-schema';

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
  // The persona seeder's v3 demonstration set (practice program + scorekeeper
  // queue) needs competitions and matches, with squads → rosters between them
  // for the matches FK chain.
  CompetitionsSchema1723300000000,
  SquadsSchema1723400000000,
  RostersSchema1723500000000,
  MatchesSchema1723600000000,
  MatchLineupsSchema1723700000000,
  PlatformLifecycleSchema1723800000000,
];
const MIGRATION_COUNT = ALL_MIGRATIONS.length;
// Every registered seeder writes exactly one seed_history row on a fresh boot.
const SEEDER_COUNT = 3;
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
