import { buildDataSourceOptions } from '@app/database/data-source.factory';
import {
  SEED_ADMIN_KEY,
  SEED_PERSONAS_KEY,
  SEED_TEAM_KEY,
} from '@app/database/seeds/seed.constants';
import type { Seeder } from '@app/database/seeds/seed.types';
import { PERSONA_DEFINITIONS } from '@app/database/seeds/seed-personas.constants';
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
import { PlatformLifecycleSchema1723800000000 } from '../../src/database/migrations/1723800000000-platform-lifecycle-schema';

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
  PlatformLifecycleSchema1723800000000,
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

const PERSONAS_CONFIG = { password: 'runtime-only-persona-password' };

const COUNTED_TABLES = [
  'teams',
  'seasons',
  'memberships',
  'membership_status_events',
  'user_role_assignments',
  'reference_catalog_entries',
  'venues',
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
    loadPersonasConfig: () => PERSONAS_CONFIG,
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
        WHERE "m"."deleted_at" IS NULL AND lower("u"."email") = lower($1)`,
      [ADMIN_CONFIG.email],
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

  it('opens every membership lifecycle history with an active event', async () => {
    const events = await dataSource.query(
      `SELECT DISTINCT "from_status", "to_status"
         FROM "membership_status_events"`,
    );

    expect(events).toEqual([{ from_status: null, to_status: 'active' }]);
  });

  it('grants the administrator a team-scoped TEAM_ADMIN assignment', async () => {
    const assignments = await dataSource.query(
      `SELECT "r"."key", "a"."season_id", "a"."revoked_at"
         FROM "user_role_assignments" "a"
         JOIN "roles" "r" ON "r"."id" = "a"."role_id"
         JOIN "users" "u" ON "u"."id" = "a"."user_id"
        WHERE "a"."team_id" IS NOT NULL AND lower("u"."email") = lower($1)`,
      [ADMIN_CONFIG.email],
    );

    expect(assignments).toEqual([
      { key: 'TEAM_ADMIN', season_id: null, revoked_at: null },
    ]);
  });

  it('bumps the RBAC policy version once per assignment-writing seeder', async () => {
    const version = await dataSource.query(
      `SELECT "version" FROM "rbac_policy_version" WHERE "singleton" = true`,
    );

    // Baseline 1, plus one bump each from the team and persona seeders.
    expect(version[0].version).toBe(3);
  });

  it('seeds every persona with a credential, membership, profile and scoped role', async () => {
    const personas = await dataSource.query(
      `SELECT lower("u"."email") AS email, "u"."role" AS account_role,
              "r"."key" AS role_key, "a"."team_id" IS NULL AS platform_scoped,
              "c"."user_id" IS NOT NULL AS has_credential,
              "m"."status" AS membership_status,
              "p"."membership_id" IS NOT NULL AS has_profile
         FROM "users" "u"
         JOIN "user_role_assignments" "a" ON "a"."user_id" = "u"."id"
         JOIN "roles" "r" ON "r"."id" = "a"."role_id"
         LEFT JOIN "password_credentials" "c" ON "c"."user_id" = "u"."id"
         LEFT JOIN "memberships" "m" ON "m"."user_id" = "u"."id"
         LEFT JOIN "member_profiles" "p" ON "p"."membership_id" = "m"."id"
        WHERE "u"."email" LIKE '%@ultimatenatives.local'
        ORDER BY lower("u"."email")`,
    );

    expect(personas).toHaveLength(PERSONA_DEFINITIONS.length);
    for (const persona of personas) {
      expect(persona.has_credential).toBe(true);
      expect(persona.membership_status).toBe('active');
      // The persona seeder writes a member profile per membership so the
      // member directory is populated on a fresh database (P0-4).
      expect(persona.has_profile).toBe(true);
    }

    const superAdmin = personas.find(
      (row: { email: string }) =>
        row.email === 'superadmin@ultimatenatives.local',
    );
    expect(superAdmin).toMatchObject({
      account_role: 'admin',
      role_key: 'SUPER_ADMIN',
      platform_scoped: true,
    });

    const teamAdmin = personas.find(
      (row: { email: string }) =>
        row.email === 'teamadmin@ultimatenatives.local',
    );
    expect(teamAdmin).toMatchObject({
      account_role: 'user',
      role_key: 'TEAM_ADMIN',
      platform_scoped: false,
    });
  });

  it('seeds reference catalog entries and venues so pickers are never empty', async () => {
    const catalogs = await dataSource.query(
      `SELECT DISTINCT "catalog" FROM "reference_catalog_entries"
        ORDER BY "catalog"`,
    );
    const venues = await dataSource.query(
      `SELECT COUNT(*)::int AS count FROM "venues"`,
    );

    expect(catalogs.map((row: { catalog: string }) => row.catalog)).toEqual([
      'division',
      'gender_format',
      'position',
    ]);
    expect(venues[0].count).toBeGreaterThan(0);
  });

  it('writes one seed_history row per seeder', async () => {
    const history = await dataSource.query(
      `SELECT "seed_key", "applied_by", "checksum" FROM "seed_history"
        ORDER BY "seed_key"`,
    );

    expect(history.map((row: { seed_key: string }) => row.seed_key)).toEqual([
      SEED_ADMIN_KEY,
      SEED_PERSONAS_KEY,
      SEED_TEAM_KEY,
    ]);
    for (const row of history) {
      expect(row.applied_by).toBe('boot');
      expect(row.checksum).toEqual(expect.any(String));
    }
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
      { key: SEED_ADMIN_KEY, application: 'skipped' },
      { key: SEED_TEAM_KEY, application: 'skipped' },
      { key: SEED_PERSONAS_KEY, application: 'skipped' },
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
