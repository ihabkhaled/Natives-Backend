import { buildDataSourceOptions } from '@app/database/data-source.factory';
import { SEED_TEAM_KEY } from '@app/database/seeds/seed.constants';
import type { Seeder } from '@app/database/seeds/seed.types';
import { buildSeeders } from '@app/database/seeds/seed-registry';
import { runSeeders } from '@app/database/seeds/seed-runner';
import type { DatabaseConfig } from '@config/config.types';
import type { AppLogger } from '@core/logger';
import { Client } from 'pg';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { BaselineSchema1721200000000 } from '../../src/database/migrations/1721200000000-baseline-schema';
import { IdentitySchema1721300000000 } from '../../src/database/migrations/1721300000000-identity-schema';
import { RbacSchema1721400000000 } from '../../src/database/migrations/1721400000000-rbac-schema';
import { TeamsSchema1721500000000 } from '../../src/database/migrations/1721500000000-teams-schema';
import { MembersSchema1721600000000 } from '../../src/database/migrations/1721600000000-members-schema';
import { SeedHistorySchema1722600000000 } from '../../src/database/migrations/1722600000000-seed-history-schema';

// The team seeder only touches identity, RBAC, teams, members, and the seed
// ledger, so the fixture applies exactly those schemas onto a disposable
// database of its own — the shared natives_test database is never mutated.
const SEED_MIGRATIONS = [
  BaselineSchema1721200000000,
  IdentitySchema1721300000000,
  RbacSchema1721400000000,
  TeamsSchema1721500000000,
  MembersSchema1721600000000,
  SeedHistorySchema1722600000000,
];

const HOST = process.env['TEST_DB_HOST'] ?? '127.0.0.1';
const PORT = Number(process.env['TEST_DB_PORT'] ?? '55432');
const USER = process.env['TEST_DB_USERNAME'] ?? 'natives_test';
const PASSWORD = process.env['TEST_DB_PASSWORD'] ?? 'natives_test';
const SEED_DB = 'natives_team_seed_test';
const MAINTENANCE_DB = 'postgres';

const SEED_DB_CONFIG: DatabaseConfig = {
  url: undefined,
  host: HOST,
  port: PORT,
  username: USER,
  password: PASSWORD,
  name: SEED_DB,
  poolMin: 1,
  poolMax: 4,
  connectTimeoutMs: 3000,
  statementTimeoutMs: 10_000,
  ssl: false,
  logging: false,
  migrationsRunOnStart: false,
  seedOnStart: false,
};

const ADMIN_CONFIG = {
  email: 'team-seed-admin@example.test',
  password: 'runtime-only-password',
  displayName: 'Team Seed Admin',
};

const COUNTED_TABLES = [
  'teams',
  'seasons',
  'memberships',
  'membership_status_events',
  'user_role_assignments',
  'seed_history',
];

function buildLogger() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    setContext: vi.fn(),
  };
}

function seeders(): readonly Seeder[] {
  return buildSeeders({
    passwordHash: {
      hash: (value: string) => Promise.resolve(`hashed:${value}`),
    },
    loadAdminConfig: () => ADMIN_CONFIG,
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
  ? 'Ultimate Natives team seed integration'
  : `Ultimate Natives team seed integration (SKIPPED: unreachable at ${HOST}:${PORT} — start docker-compose.test.yml)`;

describeIfDb(suiteTitle, () => {
  const client = maintenance;
  if (!client) {
    return;
  }

  let dataSource: DataSource;

  async function countRows(): Promise<Record<string, number>> {
    const counts: Record<string, number> = {};
    for (const table of COUNTED_TABLES) {
      const rows = await dataSource.query(
        `SELECT COUNT(*)::int AS count FROM "${table}"`,
      );
      counts[table] = rows[0].count;
    }
    return counts;
  }

  function applySeeders(seeds: readonly Seeder[], logger: AppLogger) {
    return runSeeders(dataSource, seeds, logger, 'boot');
  }

  beforeAll(async () => {
    await client.query(`DROP DATABASE IF EXISTS "${SEED_DB}" WITH (FORCE)`);
    await client.query(`CREATE DATABASE "${SEED_DB}"`);
    dataSource = new DataSource({
      ...buildDataSourceOptions(SEED_DB_CONFIG),
      migrations: SEED_MIGRATIONS,
    });
    await dataSource.initialize();
    await dataSource.runMigrations();
    await applySeeders(seeders(), buildLogger() as unknown as AppLogger);
  }, 60_000);

  afterAll(async () => {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
    await client.query(`DROP DATABASE IF EXISTS "${SEED_DB}" WITH (FORCE)`);
    await client.end();
  });

  it('creates exactly one Ultimate Natives team with the black branding', async () => {
    const teams = await dataSource.query(
      `SELECT "slug", "name", "primary_color", "locale", "timezone", "status"
         FROM "teams"`,
    );

    expect(teams).toEqual([
      {
        slug: 'un',
        name: 'Ultimate Natives',
        primary_color: '#000000',
        locale: 'en',
        timezone: 'Africa/Cairo',
        status: 'active',
      },
    ]);
  });

  it('creates the active season covering the year it was seeded', async () => {
    const seasons = await dataSource.query(
      `SELECT "slug", "name", to_char("starts_on", 'YYYY-MM-DD') AS starts_on,
              to_char("ends_on", 'YYYY-MM-DD') AS ends_on, "status",
              to_char(now(), 'YYYY') AS current_year
         FROM "seasons"`,
    );

    expect(seasons).toHaveLength(1);
    const year = seasons[0].current_year;
    expect(seasons[0]).toMatchObject({
      slug: year,
      name: `Season ${year}`,
      starts_on: `${year}-01-01`,
      ends_on: `${year}-12-31`,
      status: 'active',
    });
  });

  it('links the seeded administrator with an active team membership', async () => {
    const memberships = await dataSource.query(
      `SELECT "m"."status", "m"."season_id", "m"."joined_at", "t"."slug",
              lower("u"."email") AS email
         FROM "memberships" "m"
         JOIN "teams" "t" ON "t"."id" = "m"."team_id"
         JOIN "users" "u" ON "u"."id" = "m"."user_id"
        WHERE "m"."deleted_at" IS NULL`,
    );

    expect(memberships).toHaveLength(1);
    expect(memberships[0]).toMatchObject({
      status: 'active',
      season_id: null,
      slug: 'un',
      email: ADMIN_CONFIG.email,
    });
    expect(memberships[0].joined_at).not.toBeNull();
  });

  it('opens the membership lifecycle history with an active event', async () => {
    const events = await dataSource.query(
      `SELECT "from_status", "to_status" FROM "membership_status_events"`,
    );

    expect(events).toEqual([{ from_status: null, to_status: 'active' }]);
  });

  it('grants a team-scoped TEAM_ADMIN assignment and bumps the policy version', async () => {
    const assignments = await dataSource.query(
      `SELECT "r"."key", "a"."team_id" IS NOT NULL AS scoped, "a"."season_id",
              "a"."revoked_at"
         FROM "user_role_assignments" "a"
         JOIN "roles" "r" ON "r"."id" = "a"."role_id"
        WHERE "a"."team_id" IS NOT NULL`,
    );
    const version = await dataSource.query(
      `SELECT "version" FROM "rbac_policy_version" WHERE "singleton" = true`,
    );

    expect(assignments).toEqual([
      {
        key: 'TEAM_ADMIN',
        scoped: true,
        season_id: null,
        revoked_at: null,
      },
    ]);
    expect(version[0].version).toBe(2);
  });

  it('writes the seed_history row for the team seed key', async () => {
    const history = await dataSource.query(
      `SELECT "seed_key", "applied_by", "checksum" FROM "seed_history"
        ORDER BY "seed_key"`,
    );

    expect(history.map((row: { seed_key: string }) => row.seed_key)).toEqual([
      'admin',
      SEED_TEAM_KEY,
    ]);
    const teamRow = history[1];
    expect(teamRow.applied_by).toBe('boot');
    expect(teamRow.checksum).toEqual(expect.any(String));
  });

  it('changes nothing on a second run and never re-seeds', async () => {
    const before = await countRows();
    const appliedAtBefore = await dataSource.query(
      `SELECT "applied_at" FROM "seed_history" WHERE "seed_key" = $1`,
      [SEED_TEAM_KEY],
    );
    const logger = buildLogger();

    const outcomes = await applySeeders(
      seeders(),
      logger as unknown as AppLogger,
    );

    expect(outcomes).toEqual([
      { key: 'admin', application: 'skipped' },
      { key: SEED_TEAM_KEY, application: 'skipped' },
    ]);
    expect(await countRows()).toEqual(before);
    const appliedAtAfter = await dataSource.query(
      `SELECT "applied_at" FROM "seed_history" WHERE "seed_key" = $1`,
      [SEED_TEAM_KEY],
    );
    expect(appliedAtAfter[0].applied_at).toEqual(appliedAtBefore[0].applied_at);
  });

  it('warns about checksum drift instead of silently re-running', async () => {
    const before = await countRows();
    const drifted = seeders().map(seeder =>
      seeder.key === SEED_TEAM_KEY
        ? { ...seeder, checksum: 'a-different-definition-checksum' }
        : seeder,
    );
    const logger = buildLogger();

    const outcomes = await applySeeders(
      drifted,
      logger as unknown as AppLogger,
    );

    expect(outcomes).toContainEqual({
      key: SEED_TEAM_KEY,
      application: 'changed',
    });
    expect(logger.warn).toHaveBeenCalledWith(expect.any(String), {
      key: SEED_TEAM_KEY,
    });
    expect(await countRows()).toEqual(before);
  });
});
