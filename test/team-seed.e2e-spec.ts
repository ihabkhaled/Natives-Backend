import { configureLifecycle } from '@app/bootstrap/configure-lifecycle';
import { configureSecurity } from '@app/bootstrap/configure-security';
import { configureValidation } from '@app/bootstrap/configure-validation';
import { createApp } from '@app/bootstrap/create-app';
import { buildDataSourceOptions } from '@app/database/data-source.factory';
import { buildSeeders } from '@app/database/seeds/seed-registry';
import { runSeeders } from '@app/database/seeds/seed-runner';
import type { DatabaseConfig } from '@config/config.types';
import type { AppLogger } from '@core/logger';
import { PasswordHashAdapter } from '@modules/auth/adapters/password-hash.adapter';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { Client } from 'pg';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { BaselineSchema1721200000000 } from '../src/database/migrations/1721200000000-baseline-schema';
import { IdentitySchema1721300000000 } from '../src/database/migrations/1721300000000-identity-schema';
import { RbacSchema1721400000000 } from '../src/database/migrations/1721400000000-rbac-schema';
import { TeamsSchema1721500000000 } from '../src/database/migrations/1721500000000-teams-schema';
import { MembersSchema1721600000000 } from '../src/database/migrations/1721600000000-members-schema';
import { SeedHistorySchema1722600000000 } from '../src/database/migrations/1722600000000-seed-history-schema';

// Proves the seeded principal contract over real HTTP on a disposable database
// of its own: the once-only seeders are the ONLY writes, so `/auth/me` here is
// exactly what a freshly provisioned deployment returns.
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
const SEED_DB = 'natives_team_seed_e2e_test';
const MAINTENANCE_DB = 'postgres';
const SEED_DB_URL = `postgres://${USER}:${PASSWORD}@${HOST}:${PORT}/${SEED_DB}`;

const SEED_DB_CONFIG: DatabaseConfig = {
  url: SEED_DB_URL,
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

const ADMIN_EMAIL = 'seeded-admin@example.test';
const ADMIN_PASSWORD = 'correct-horse-battery-staple';
const ADMIN_DISPLAY_NAME = 'Seeded Administrator';

function buildLogger(): AppLogger {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    setContext: vi.fn(),
  } as unknown as AppLogger;
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

async function provision(client: Client): Promise<DataSource> {
  await client.query(`DROP DATABASE IF EXISTS "${SEED_DB}" WITH (FORCE)`);
  await client.query(`CREATE DATABASE "${SEED_DB}"`);
  const dataSource = new DataSource({
    ...buildDataSourceOptions(SEED_DB_CONFIG),
    migrations: SEED_MIGRATIONS,
  });
  await dataSource.initialize();
  await dataSource.runMigrations();
  await runSeeders(
    dataSource,
    buildSeeders({
      passwordHash: new PasswordHashAdapter(),
      loadAdminConfig: () => ({
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        displayName: ADMIN_DISPLAY_NAME,
      }),
    }),
    buildLogger(),
    'boot',
  );
  return dataSource;
}

const ORIGINAL_DATABASE_URL = process.env['DATABASE_URL'];
const maintenance = await connectMaintenanceOrNull();
const seededDataSource = maintenance ? await provision(maintenance) : null;

const describeIfDb = seededDataSource ? describe : describe.skip;
const suiteTitle = seededDataSource
  ? 'Seeded Ultimate Natives principal (e2e, PostgreSQL)'
  : `Seeded Ultimate Natives principal (e2e) (SKIPPED: test database unreachable at ${HOST}:${PORT} — start docker-compose.test.yml)`;

describeIfDb(suiteTitle, () => {
  const activeDataSource = seededDataSource;
  const client = maintenance;
  if (activeDataSource === null || client === null) {
    return;
  }

  let app: NestFastifyApplication;

  beforeAll(async () => {
    // Sibling e2e suites reset DATABASE_URL in their afterAll, and this suite's
    // app is only created now — re-assert its own disposable database.
    process.env['DATABASE_URL'] = SEED_DB_URL;
    app = await createApp();
    await configureSecurity(app);
    await configureValidation(app);
    configureLifecycle(app);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  }, 60_000);

  afterAll(async () => {
    await app.close();
    await activeDataSource.destroy();
    await client.query(`DROP DATABASE IF EXISTS "${SEED_DB}" WITH (FORCE)`);
    await client.end();
    if (ORIGINAL_DATABASE_URL === undefined) {
      delete process.env['DATABASE_URL'];
    } else {
      process.env['DATABASE_URL'] = ORIGINAL_DATABASE_URL;
    }
  });

  async function login(): Promise<request.Response> {
    return request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  }

  it('POST /auth/login returns the seeded team membership', async () => {
    const response = await login();

    expect(response.status).toBe(200);
    expect(response.body.user.memberships).toEqual([
      expect.objectContaining({
        teamSlug: 'un',
        teamName: 'Ultimate Natives',
        status: 'active',
        roles: ['team_admin'],
      }),
    ]);
  });

  it('GET /auth/me returns the seeded team membership with its current season', async () => {
    const loggedIn = await login();

    const response = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set(
        'Authorization',
        `Bearer ${loggedIn.body.tokens.accessToken as string}`,
      );

    expect(response.status).toBe(200);
    expect(response.body.email).toBe(ADMIN_EMAIL);
    expect(response.body.memberships).toHaveLength(1);
    const membership = response.body.memberships[0];
    expect(membership).toMatchObject({
      teamSlug: 'un',
      teamName: 'Ultimate Natives',
      status: 'active',
      roles: ['team_admin'],
    });
    expect(membership.seasonSlug).toBe(String(new Date().getUTCFullYear()));
    expect(membership.membershipId).toEqual(expect.any(String));
  });

  it('gives the seeded administrator the team-management permissions', async () => {
    const loggedIn = await login();

    const response = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set(
        'Authorization',
        `Bearer ${loggedIn.body.tokens.accessToken as string}`,
      );

    expect(response.body.permissions).toEqual(
      expect.arrayContaining([
        'team.settings.manage',
        'member.invite',
        'member.roles.manage',
      ]),
    );
  });
});
