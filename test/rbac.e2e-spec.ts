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
};

const TEAM_A = randomUUID();
const TEAM_B = randomUUID();

interface Fixture {
  readonly dataSource: DataSource;
  readonly adminId: string;
  readonly memberId: string;
  readonly teamAdminUserId: string;
  readonly inactiveAdminId: string;
  readonly promoteId: string;
}

async function seedUser(
  dataSource: DataSource,
  status: string,
  role: Role,
): Promise<string> {
  const id = randomUUID();
  await dataSource.query(
    `INSERT INTO "users" ("id", "email", "role", "status") VALUES ($1, $2, $3, $4)`,
    [id, `user-${id}@example.test`, role, status],
  );
  return id;
}

async function assignTeamAdmin(
  dataSource: DataSource,
  userId: string,
  teamId: string,
): Promise<void> {
  const role = await dataSource.query(
    `SELECT "id" FROM "roles" WHERE "key" = $1`,
    [RbacRole.TeamAdmin],
  );
  await dataSource.query(
    `INSERT INTO "user_role_assignments"
       ("id", "user_id", "role_id", "team_id") VALUES ($1, $2, $3, $4)`,
    [randomUUID(), userId, role[0].id, teamId],
  );
  await dataSource.query(
    `UPDATE "rbac_policy_version" SET "version" = "version" + 1 WHERE "singleton" = true`,
  );
}

async function migrateAndSeed(): Promise<Fixture | null> {
  try {
    const dataSource = new DataSource({
      ...buildDataSourceOptions(TEST_DB_CONFIG),
      migrations: [
        BaselineSchema1721200000000,
        IdentitySchema1721300000000,
        RbacSchema1721400000000,
      ],
    });
    await dataSource.initialize();
    await dataSource.runMigrations();
    const adminId = await seedUser(dataSource, 'active', Role.Admin);
    const memberId = await seedUser(dataSource, 'active', Role.User);
    const teamAdminUserId = await seedUser(dataSource, 'active', Role.User);
    const inactiveAdminId = await seedUser(dataSource, 'suspended', Role.Admin);
    const promoteId = await seedUser(dataSource, 'active', Role.User);
    await assignTeamAdmin(dataSource, teamAdminUserId, TEAM_A);
    return {
      dataSource,
      adminId,
      memberId,
      teamAdminUserId,
      inactiveAdminId,
      promoteId,
    };
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
  ? 'RBAC authorization matrix (e2e, PostgreSQL)'
  : `RBAC (e2e) (SKIPPED: test database unreachable at ${TEST_DB_HOST}:${TEST_DB_PORT} — start docker-compose.test.yml)`;

describeIfDb(suiteTitle, () => {
  if (!seeded) {
    return;
  }
  const fixture: Fixture = seeded;
  let app: NestFastifyApplication;

  async function tokenFor(userId: string, roles: Role[]): Promise<string> {
    const tokenPort = app.get<AuthTokenPort>(AUTH_TOKEN_PORT);
    return tokenPort.sign({ userId, email: 'e@example.test', roles });
  }

  async function newTarget(): Promise<string> {
    return seedUser(fixture.dataSource, 'active', Role.User);
  }

  beforeAll(async () => {
    // Re-assert the test DB URL here: sibling e2e suites reset DATABASE_URL in
    // their afterAll, and this suite's app is only created now.
    process.env['DATABASE_URL'] = TEST_DB_URL;
    app = await createApp();
    await configureSecurity(app);
    await configureValidation(app);
    configureLifecycle(app);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
    if (seededDataSource) {
      await seededDataSource.undoLastMigration();
      await seededDataSource.undoLastMigration();
      await seededDataSource.undoLastMigration();
      await seededDataSource.destroy();
    }
    if (ORIGINAL_DATABASE_URL === undefined) {
      delete process.env['DATABASE_URL'];
    } else {
      process.env['DATABASE_URL'] = ORIGINAL_DATABASE_URL;
    }
  });

  it('allows a system admin to assign a role', async () => {
    const token = await tokenFor(fixture.adminId, [Role.Admin]);
    const target = await newTarget();

    const response = await request(app.getHttpServer())
      .post('/api/v1/rbac/assignments')
      .set('Authorization', `Bearer ${token}`)
      .send({ userId: target, roleKey: RbacRole.Member });

    expect(response.status).toBe(201);
    expect(response.body.roleKey).toBe(RbacRole.Member);
  });

  it('forbids a member without the manage permission (403)', async () => {
    const token = await tokenFor(fixture.memberId, [Role.User]);

    const response = await request(app.getHttpServer())
      .post('/api/v1/rbac/assignments')
      .set('Authorization', `Bearer ${token}`)
      .send({ userId: fixture.memberId, roleKey: RbacRole.Member });

    expect(response.status).toBe(403);
    expect(response.body.messageKey).toBe('errors.auth.permissionDenied');
  });

  it('denies an inactive (suspended) principal (403)', async () => {
    const token = await tokenFor(fixture.inactiveAdminId, [Role.Admin]);
    const target = await newTarget();

    const response = await request(app.getHttpServer())
      .post('/api/v1/rbac/assignments')
      .set('Authorization', `Bearer ${token}`)
      .send({ userId: target, roleKey: RbacRole.Member });

    expect(response.status).toBe(403);
    expect(response.body.messageKey).toBe('errors.auth.permissionDenied');
  });

  it('allows a team admin within their team but denies another team (403)', async () => {
    const token = await tokenFor(fixture.teamAdminUserId, [Role.User]);
    const target = await newTarget();

    const allowed = await request(app.getHttpServer())
      .post(`/api/v1/rbac/assignments?teamId=${TEAM_A}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ userId: target, roleKey: RbacRole.Member });
    expect(allowed.status).toBe(201);

    const denied = await request(app.getHttpServer())
      .post(`/api/v1/rbac/assignments?teamId=${TEAM_B}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ userId: target, roleKey: RbacRole.Member });
    expect(denied.status).toBe(403);
    expect(denied.body.messageKey).toBe('errors.auth.permissionDenied');
  });

  it('rejects an escalation beyond the actor ceiling (403)', async () => {
    const token = await tokenFor(fixture.teamAdminUserId, [Role.User]);
    const target = await newTarget();

    // A team admin lacks match.score, which the SCOREKEEPER bundle grants.
    const response = await request(app.getHttpServer())
      .post(`/api/v1/rbac/assignments?teamId=${TEAM_A}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ userId: target, roleKey: RbacRole.Scorekeeper });

    expect(response.status).toBe(403);
    expect(response.body.messageKey).toBe('errors.rbac.escalationDenied');
  });

  it('returns 404 for a forged (non-existent) assignment id', async () => {
    const token = await tokenFor(fixture.adminId, [Role.Admin]);

    const response = await request(app.getHttpServer())
      .delete(`/api/v1/rbac/assignments/${randomUUID()}`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(404);
    expect(response.body.messageKey).toBe('errors.rbac.assignmentNotFound');
  });

  it('returns the caller own permissions (self-only) and blocks inspecting others', async () => {
    const memberToken = await tokenFor(fixture.memberId, [Role.User]);

    const mine = await request(app.getHttpServer())
      .get('/api/v1/rbac/me/permissions')
      .set('Authorization', `Bearer ${memberToken}`);
    expect(mine.status).toBe(200);
    expect(mine.body.userId).toBe(fixture.memberId);
    expect(mine.body.permissions).toContain('team.read');

    const others = await request(app.getHttpServer())
      .get(`/api/v1/rbac/users/${fixture.adminId}/assignments`)
      .set('Authorization', `Bearer ${memberToken}`);
    expect(others.status).toBe(403);
    expect(others.body.messageKey).toBe('errors.auth.permissionDenied');
  });

  it('invalidates a stale cache after an assignment change', async () => {
    const promoteToken = await tokenFor(fixture.promoteId, [Role.User]);
    const adminToken = await tokenFor(fixture.adminId, [Role.Admin]);
    const target = await newTarget();

    const before = await request(app.getHttpServer())
      .post('/api/v1/rbac/assignments')
      .set('Authorization', `Bearer ${promoteToken}`)
      .send({ userId: target, roleKey: RbacRole.Member });
    expect(before.status).toBe(403);

    // Admin grants the promote user a global TEAM_ADMIN role (bumps policy version).
    const grant = await request(app.getHttpServer())
      .post('/api/v1/rbac/assignments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ userId: fixture.promoteId, roleKey: RbacRole.TeamAdmin });
    expect(grant.status).toBe(201);

    const after = await request(app.getHttpServer())
      .post('/api/v1/rbac/assignments')
      .set('Authorization', `Bearer ${promoteToken}`)
      .send({ userId: target, roleKey: RbacRole.Member });
    expect(after.status).toBe(201);
  });
});
