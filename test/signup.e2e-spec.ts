import { randomUUID } from 'node:crypto';

import { configureLifecycle } from '@app/bootstrap/configure-lifecycle';
import { configureSecurity } from '@app/bootstrap/configure-security';
import { configureValidation } from '@app/bootstrap/configure-validation';
import { createApp } from '@app/bootstrap/create-app';
import { buildDataSourceOptions } from '@app/database/data-source.factory';
import type { DatabaseConfig } from '@config/config.types';
import { AUTH_TOKEN_PORT, type AuthTokenPort } from '@core/auth';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { RbacRole, Role } from '@shared/enums';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { BaselineSchema1721200000000 } from '../src/database/migrations/1721200000000-baseline-schema';
import { IdentitySchema1721300000000 } from '../src/database/migrations/1721300000000-identity-schema';
import { RbacSchema1721400000000 } from '../src/database/migrations/1721400000000-rbac-schema';
import { TeamsSchema1721500000000 } from '../src/database/migrations/1721500000000-teams-schema';
import { MembersSchema1721600000000 } from '../src/database/migrations/1721600000000-members-schema';
import { PlatformLifecycleSchema1723800000000 } from '../src/database/migrations/1723800000000-platform-lifecycle-schema';
import { InvitationsTeamScope1724800000000 } from '../src/database/migrations/1724800000000-invitations-team-scope';
import { RbacRoleCatalogMetadata1725000000000 } from '../src/database/migrations/1725000000000-rbac-role-catalog-metadata';
import { InvitationTeamRole1725100000000 } from '../src/database/migrations/1725100000000-invitation-team-role';
import { SignupReview1725600000000 } from '../src/database/migrations/1725600000000-signup-review';

const TEST_DB_HOST = process.env['TEST_DB_HOST'] ?? '127.0.0.1';
const TEST_DB_PORT = process.env['TEST_DB_PORT'] ?? '55432';
const TEST_DB_USER = process.env['TEST_DB_USERNAME'] ?? 'natives_test';
const TEST_DB_PASSWORD = process.env['TEST_DB_PASSWORD'] ?? 'natives_test';
const TEST_DB_NAME = process.env['TEST_DB_NAME'] ?? 'natives_test';
const TEST_DB_URL =
  process.env['TEST_DATABASE_URL'] ??
  `postgres://${TEST_DB_USER}:${TEST_DB_PASSWORD}@${TEST_DB_HOST}:${TEST_DB_PORT}/${TEST_DB_NAME}`;

const TEST_DB_CONFIG: DatabaseConfig = {
  url: TEST_DB_URL,
  host: TEST_DB_HOST,
  port: Number(TEST_DB_PORT),
  username: TEST_DB_USER,
  password: TEST_DB_PASSWORD,
  name: TEST_DB_NAME,
  poolMin: 1,
  poolMax: 4,
  connectTimeoutMs: 3000,
  statementTimeoutMs: 5000,
  ssl: false,
  logging: false,
  migrationsRunOnStart: false,
  seedOnStart: false,
};

const MIGRATIONS = [
  BaselineSchema1721200000000,
  IdentitySchema1721300000000,
  RbacSchema1721400000000,
  TeamsSchema1721500000000,
  MembersSchema1721600000000,
  PlatformLifecycleSchema1723800000000,
  InvitationsTeamScope1724800000000,
  RbacRoleCatalogMetadata1725000000000,
  InvitationTeamRole1725100000000,
  SignupReview1725600000000,
];

const PASSWORD = 'correct-horse-battery-staple';

interface Fixture {
  readonly dataSource: DataSource;
  readonly adminId: string;
}

async function migrateAndSeed(): Promise<Fixture | null> {
  try {
    const dataSource = new DataSource({
      ...buildDataSourceOptions(TEST_DB_CONFIG),
      migrations: MIGRATIONS,
    });
    await dataSource.initialize();
    await dataSource.runMigrations();
    const adminId = randomUUID();
    await dataSource.query(
      `INSERT INTO "users" ("id", "email", "role", "status") VALUES ($1, $2, $3, 'active')`,
      [adminId, `admin-${randomUUID()}@example.test`, Role.Admin],
    );
    const role = await dataSource.query(
      `SELECT "id" FROM "roles" WHERE "key" = $1`,
      [RbacRole.SuperAdmin],
    );
    await dataSource.query(
      `INSERT INTO "user_role_assignments" ("id", "user_id", "role_id", "team_id")
       VALUES ($1, $2, $3, NULL)`,
      [randomUUID(), adminId, role[0].id],
    );
    await dataSource.query(
      `UPDATE "rbac_policy_version" SET "version" = "version" + 1 WHERE "singleton" = true`,
    );
    return { dataSource, adminId };
  } catch {
    return null;
  }
}

const ORIGINAL_DATABASE_URL = process.env['DATABASE_URL'];
process.env['DATABASE_URL'] = TEST_DB_URL;
const seeded = await migrateAndSeed();
const seededDataSource = seeded?.dataSource ?? null;

const describeIfDb = seededDataSource ? describe : describe.skip;
const suiteTitle = seededDataSource
  ? 'Self-signup with admin approval (e2e, PostgreSQL)'
  : `Signup (e2e) (SKIPPED: test database unreachable at ${TEST_DB_HOST}:${TEST_DB_PORT} — start docker-compose.test.yml)`;

describeIfDb(suiteTitle, () => {
  if (!seeded) {
    return;
  }
  const fixture: Fixture = seeded;
  let app: NestFastifyApplication;
  let adminToken: string;

  function api() {
    return request(app.getHttpServer());
  }

  function signup(email: string) {
    return api()
      .post('/api/v1/auth/signup')
      .send({ email, displayName: 'Applicant', password: PASSWORD });
  }

  function login(email: string) {
    return api().post('/api/v1/auth/login').send({ email, password: PASSWORD });
  }

  beforeAll(async () => {
    process.env['DATABASE_URL'] = TEST_DB_URL;
    app = await createApp();
    await configureSecurity(app);
    await configureValidation(app);
    configureLifecycle(app);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    const tokenPort = app.get<AuthTokenPort>(AUTH_TOKEN_PORT);
    adminToken = await tokenPort.sign({
      userId: fixture.adminId,
      email: 'admin@example.test',
      roles: [Role.Admin],
    });
  });

  afterAll(async () => {
    await app.close();
    let remaining = MIGRATIONS.length;
    while (remaining > 0) {
      await fixture.dataSource.undoLastMigration();
      remaining -= 1;
    }
    await fixture.dataSource.destroy();
    if (ORIGINAL_DATABASE_URL === undefined) {
      delete process.env['DATABASE_URL'];
    } else {
      process.env['DATABASE_URL'] = ORIGINAL_DATABASE_URL;
    }
  });

  it('accepts a signup into a pending, inert account', async () => {
    const email = `pending-${randomUUID()}@example.test`;
    const response = await signup(email);

    expect(response.status).toBe(201);
    expect(response.body.state).toBe('pending');
    expect(response.body).not.toHaveProperty('accessToken');
    expect(response.body).not.toHaveProperty('token');
  });

  it('refuses login for an account still awaiting approval', async () => {
    const email = `inert-${randomUUID()}@example.test`;
    await signup(email);

    const response = await login(email);
    expect(response.status).toBe(401);
    expect(response.body.messageKey).toBe('errors.auth.invalidCredentials');
  });

  it('rejects a duplicate signup for the same email', async () => {
    const email = `dupe-${randomUUID()}@example.test`;
    await signup(email);

    const response = await signup(email);
    expect(response.status).toBe(409);
  });

  it('validates the request body', async () => {
    const response = await api()
      .post('/api/v1/auth/signup')
      .send({ email: 'not-an-email', displayName: '', password: 'short' });
    expect(response.status).toBe(400);
  });

  it('requires a privileged actor to list or review signups', async () => {
    const response = await api().get('/api/v1/auth/signups/pending');
    expect(response.status).toBe(401);
  });

  it('lets an admin approve a pending signup, which then activates login', async () => {
    const email = `approve-${randomUUID()}@example.test`;
    await signup(email);

    const pending = await api()
      .get('/api/v1/auth/signups/pending')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(pending.status).toBe(200);
    const match = (pending.body.items as { id: string; email: string }[]).find(
      item => item.email === email,
    );
    expect(match).toBeDefined();

    const approved = await api()
      .post(`/api/v1/auth/signups/${match?.id ?? ''}/approve`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(approved.status).toBe(200);
    expect(approved.body.state).toBe('active');

    const loggedIn = await login(email);
    expect(loggedIn.status).toBe(200);
    expect(loggedIn.body.tokens.accessToken).toEqual(expect.any(String));
  });

  it('keeps a rejected signup inert and unable to log in', async () => {
    const email = `reject-${randomUUID()}@example.test`;
    await signup(email);

    const pending = await api()
      .get('/api/v1/auth/signups/pending')
      .set('Authorization', `Bearer ${adminToken}`);
    const match = (pending.body.items as { id: string; email: string }[]).find(
      item => item.email === email,
    );

    const rejected = await api()
      .post(`/api/v1/auth/signups/${match?.id ?? ''}/reject`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(rejected.status).toBe(200);

    const loggedIn = await login(email);
    expect(loggedIn.status).toBe(401);
  });

  it('reports not-found when approving an id that is not pending', async () => {
    const response = await api()
      .post(`/api/v1/auth/signups/${randomUUID()}/approve`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(response.status).toBe(404);
  });
});
