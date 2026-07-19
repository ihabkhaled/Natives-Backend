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
];

interface Fixture {
  readonly dataSource: DataSource;
  readonly adminId: string;
  readonly memberUserId: string;
  readonly teamAdminUserId: string;
  readonly suspendedAdminId: string;
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

async function migrateAndSeed(): Promise<Fixture | null> {
  try {
    const dataSource = new DataSource({
      ...buildDataSourceOptions(TEST_DB_CONFIG),
      migrations: MIGRATIONS,
    });
    await dataSource.initialize();
    await dataSource.runMigrations();
    return {
      dataSource,
      adminId: await seedUser(dataSource, 'active', Role.Admin),
      memberUserId: await seedUser(dataSource, 'active', Role.User),
      teamAdminUserId: await seedUser(dataSource, 'active', Role.User),
      suspendedAdminId: await seedUser(dataSource, 'suspended', Role.Admin),
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
  ? 'Members authorization matrix (e2e, PostgreSQL)'
  : `Members (e2e) (SKIPPED: test database unreachable at ${TEST_DB_HOST}:${TEST_DB_PORT} — start docker-compose.test.yml)`;

describeIfDb(suiteTitle, () => {
  if (!seeded) {
    return;
  }
  const fixture: Fixture = seeded;
  let app: NestFastifyApplication;
  let teamId: string;
  let memberMembershipId: string;
  const otherTeamId = randomUUID();

  function api() {
    return request(app.getHttpServer());
  }

  async function tokenFor(userId: string, roles: Role[]): Promise<string> {
    const tokenPort = app.get<AuthTokenPort>(AUTH_TOKEN_PORT);
    return tokenPort.sign({ userId, email: 'e@example.test', roles });
  }

  async function assignTeamAdmin(userId: string): Promise<void> {
    const role = await fixture.dataSource.query(
      `SELECT "id" FROM "roles" WHERE "key" = $1`,
      [RbacRole.TeamAdmin],
    );
    await fixture.dataSource.query(
      `INSERT INTO "user_role_assignments" ("id", "user_id", "role_id", "team_id")
       VALUES ($1, $2, $3, $4)`,
      [randomUUID(), userId, role[0].id, teamId],
    );
    await fixture.dataSource.query(
      `UPDATE "rbac_policy_version" SET "version" = "version" + 1 WHERE "singleton" = true`,
    );
  }

  async function invite(
    token: string,
    body: Record<string, unknown>,
  ): Promise<request.Response> {
    return api()
      .post(`/api/v1/teams/${teamId}/members/invite`)
      .set('Authorization', `Bearer ${token}`)
      .send(body);
  }

  function profileBody(overrides: Record<string, unknown> = {}) {
    return {
      fullName: 'Ahmed Hassan',
      preferredName: 'Ammar',
      email: 'ahmed@example.test',
      dateOfBirth: '2000-01-15',
      ...overrides,
    };
  }

  beforeAll(async () => {
    process.env['DATABASE_URL'] = TEST_DB_URL;
    app = await createApp();
    await configureSecurity(app);
    await configureValidation(app);
    configureLifecycle(app);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    const adminToken = await tokenFor(fixture.adminId, [Role.Admin]);
    const created = await api()
      .post('/api/v1/teams')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ slug: `natives-${randomUUID().slice(0, 8)}`, name: 'Natives' });
    teamId = created.body.id;
    await assignTeamAdmin(fixture.teamAdminUserId);

    const member = await invite(adminToken, {
      userId: fixture.memberUserId,
      profile: profileBody(),
    });
    memberMembershipId = member.body.id;
    await api()
      .post(`/api/v1/teams/${teamId}/members/${memberMembershipId}/activate`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
  });

  afterAll(async () => {
    await app.close();
    if (seededDataSource) {
      await seededDataSource.undoLastMigration();
      await seededDataSource.undoLastMigration();
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

  it('lets a system admin invite a member', async () => {
    const token = await tokenFor(fixture.adminId, [Role.Admin]);
    const response = await invite(token, { profile: profileBody() });
    expect(response.status).toBe(201);
    expect(response.body.status).toBe('invited');
  });

  it('forbids a plain member from inviting (403)', async () => {
    const token = await tokenFor(fixture.memberUserId, [Role.User]);
    const response = await invite(token, { profile: profileBody() });
    expect(response.status).toBe(403);
    expect(response.body.messageKey).toBe('errors.auth.permissionDenied');
  });

  it('denies a suspended admin every protected write (403)', async () => {
    const token = await tokenFor(fixture.suspendedAdminId, [Role.Admin]);
    const response = await invite(token, { profile: profileBody() });
    expect(response.status).toBe(403);
    expect(response.body.messageKey).toBe('errors.auth.permissionDenied');
  });

  it('lets a scoped team admin invite in their team but denies another (403)', async () => {
    const token = await tokenFor(fixture.teamAdminUserId, [Role.User]);
    const allowed = await invite(token, { profile: profileBody() });
    expect(allowed.status).toBe(201);

    const denied = await api()
      .post(`/api/v1/teams/${otherTeamId}/members/invite`)
      .set('Authorization', `Bearer ${token}`)
      .send({ profile: profileBody() });
    expect(denied.status).toBe(403);
    expect(denied.body.messageKey).toBe('errors.auth.permissionDenied');
  });

  it('returns an admin-shaped view exposing the raw date of birth', async () => {
    const token = await tokenFor(fixture.adminId, [Role.Admin]);
    const response = await api()
      .get(`/api/v1/teams/${teamId}/members/${memberMembershipId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(response.body.audience).toBe('admin');
    expect(response.body.dateOfBirth).toBe('2000-01-15');
    expect(response.body.email).toBe('ahmed@example.test');
  });

  it('shapes the self view for the owning member (own DOB, no admin fields)', async () => {
    const token = await tokenFor(fixture.memberUserId, [Role.User]);
    const response = await api()
      .get(`/api/v1/teams/${teamId}/members/${memberMembershipId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(response.body.audience).toBe('self');
    expect(response.body.dateOfBirth).toBe('2000-01-15');
    expect(response.body.version).toBeNull();
  });

  it('lets a member update their own profile (self)', async () => {
    const token = await tokenFor(fixture.memberUserId, [Role.User]);
    const response = await api()
      .patch(`/api/v1/teams/${teamId}/members/${memberMembershipId}/profile`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        profile: profileBody({ preferredName: 'Speedy' }),
        expectedVersion: 1,
      });
    expect(response.status).toBe(200);
    expect(response.body.audience).toBe('self');
    expect(response.body.displayName).toBe('Speedy');
  });

  it('forbids a member from updating another member profile (403)', async () => {
    const admin = await tokenFor(fixture.adminId, [Role.Admin]);
    const other = await invite(admin, { profile: profileBody() });
    const token = await tokenFor(fixture.memberUserId, [Role.User]);
    const response = await api()
      .patch(`/api/v1/teams/${teamId}/members/${other.body.id}/profile`)
      .set('Authorization', `Bearer ${token}`)
      .send({ profile: profileBody(), expectedVersion: 1 });
    expect(response.status).toBe(403);
    expect(response.body.messageKey).toBe('errors.members.profileForbidden');
  });

  it('rejects an invalid lifecycle transition (409)', async () => {
    const token = await tokenFor(fixture.adminId, [Role.Admin]);
    // memberMembershipId is already active; activating again is invalid.
    const response = await api()
      .post(`/api/v1/teams/${teamId}/members/${memberMembershipId}/activate`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(response.status).toBe(409);
    expect(response.body.messageKey).toBe('errors.members.invalidTransition');
  });

  it('anonymizes a member and redacts the profile while keeping the reference', async () => {
    const token = await tokenFor(fixture.adminId, [Role.Admin]);
    const invited = await invite(token, { profile: profileBody() });
    const id = invited.body.id;

    const anonymized = await api()
      .post(`/api/v1/teams/${teamId}/members/${id}/anonymize`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'data subject request' });
    expect(anonymized.status).toBe(200);
    expect(anonymized.body.status).toBe('anonymized');

    const view = await api()
      .get(`/api/v1/teams/${teamId}/members/${id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(view.status).toBe(200);
    expect(view.body.displayName).toBe('Former member');
    expect(view.body.dateOfBirth).toBeNull();
  });

  it('manages aliases: add, reject duplicate (409), then remove', async () => {
    const token = await tokenFor(fixture.adminId, [Role.Admin]);
    const added = await api()
      .post(`/api/v1/teams/${teamId}/members/${memberMembershipId}/aliases`)
      .set('Authorization', `Bearer ${token}`)
      .send({ alias: 'A. Hassan' });
    expect(added.status).toBe(201);

    const dup = await api()
      .post(`/api/v1/teams/${teamId}/members/${memberMembershipId}/aliases`)
      .set('Authorization', `Bearer ${token}`)
      .send({ alias: 'a.  hassan' });
    expect(dup.status).toBe(409);
    expect(dup.body.messageKey).toBe('errors.members.aliasConflict');

    const removed = await api()
      .delete(
        `/api/v1/teams/${teamId}/members/${memberMembershipId}/aliases/${added.body.id}`,
      )
      .set('Authorization', `Bearer ${token}`);
    expect(removed.status).toBe(204);
  });

  it('rejects a jersey number reserved by another active member (409)', async () => {
    const token = await tokenFor(fixture.adminId, [Role.Admin]);
    const holder = await invite(token, {
      profile: profileBody({ jerseyNumber: 42 }),
    });
    await api()
      .post(`/api/v1/teams/${teamId}/members/${holder.body.id}/activate`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    const contender = await invite(token, { profile: profileBody() });
    const response = await api()
      .patch(`/api/v1/teams/${teamId}/members/${contender.body.id}/profile`)
      .set('Authorization', `Bearer ${token}`)
      .send({ profile: profileBody({ jerseyNumber: 42 }), expectedVersion: 1 });
    expect(response.status).toBe(409);
    expect(response.body.messageKey).toBe('errors.members.jerseyConflict');
  });

  it('reports an optimistic version conflict on a stale profile update (409)', async () => {
    const token = await tokenFor(fixture.adminId, [Role.Admin]);
    const response = await api()
      .patch(`/api/v1/teams/${teamId}/members/${memberMembershipId}/profile`)
      .set('Authorization', `Bearer ${token}`)
      .send({ profile: profileBody(), expectedVersion: 999 });
    expect(response.status).toBe(409);
    expect(response.body.messageKey).toBe('errors.members.versionConflict');
  });

  it('returns 404 for a forged membership id', async () => {
    const token = await tokenFor(fixture.adminId, [Role.Admin]);
    const response = await api()
      .get(`/api/v1/teams/${teamId}/members/${randomUUID()}`)
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(404);
    expect(response.body.messageKey).toBe('errors.members.membershipNotFound');
  });

  it('rejects a non-uuid membership id (400)', async () => {
    const token = await tokenFor(fixture.adminId, [Role.Admin]);
    const response = await api()
      .get(`/api/v1/teams/${teamId}/members/not-a-uuid`)
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(400);
    expect(response.body.messageKey).toBe('errors.validation.invalidUuid');
  });

  it('runs the avatar media flow: request, scan, attach, access', async () => {
    const token = await tokenFor(fixture.adminId, [Role.Admin]);
    const ticket = await api()
      .post(`/api/v1/teams/${teamId}/members/${memberMembershipId}/avatar`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        contentType: 'image/png',
        byteSize: 2048,
        width: 256,
        height: 256,
      });
    expect(ticket.status).toBe(201);
    expect(ticket.body.uploadUrl).toContain('method=PUT');
    const mediaId = ticket.body.mediaId;

    const scan = await api()
      .post(
        `/api/v1/teams/${teamId}/members/${memberMembershipId}/media/${mediaId}/scan`,
      )
      .set('Authorization', `Bearer ${token}`)
      .send({ outcome: 'clean' });
    expect(scan.status).toBe(200);
    expect(scan.body.scanStatus).toBe('clean');
    expect(scan.body.storageKey).toBeUndefined();

    const attach = await api()
      .put(
        `/api/v1/teams/${teamId}/members/${memberMembershipId}/avatar/${mediaId}`,
      )
      .set('Authorization', `Bearer ${token}`)
      .send();
    expect(attach.status).toBe(200);
    expect(attach.body.hasAvatar).toBe(true);

    const access = await api()
      .get(`/api/v1/teams/${teamId}/members/${memberMembershipId}/avatar`)
      .set('Authorization', `Bearer ${token}`);
    expect(access.status).toBe(200);
    expect(access.body.url).toContain('method=GET');
  });

  it('rejects attaching media that has not cleared the scan (409)', async () => {
    const token = await tokenFor(fixture.adminId, [Role.Admin]);
    const ticket = await api()
      .post(`/api/v1/teams/${teamId}/members/${memberMembershipId}/avatar`)
      .set('Authorization', `Bearer ${token}`)
      .send({ contentType: 'image/png', byteSize: 4096 });
    const mediaId = ticket.body.mediaId;

    const attach = await api()
      .put(
        `/api/v1/teams/${teamId}/members/${memberMembershipId}/avatar/${mediaId}`,
      )
      .set('Authorization', `Bearer ${token}`)
      .send();
    expect(attach.status).toBe(409);
    expect(attach.body.messageKey).toBe('errors.members.mediaNotScanned');
  });
});
