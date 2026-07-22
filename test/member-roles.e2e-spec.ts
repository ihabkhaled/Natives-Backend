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
import { TeamAdminMatchScore1724900000000 } from '../src/database/migrations/1724900000000-team-admin-match-score';
import { RbacRoleCatalogMetadata1725000000000 } from '../src/database/migrations/1725000000000-rbac-role-catalog-metadata';

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
  TeamAdminMatchScore1724900000000,
  RbacRoleCatalogMetadata1725000000000,
];

interface Fixture {
  readonly dataSource: DataSource;
  readonly adminId: string;
  readonly memberUserId: string;
  readonly coachUserId: string;
  readonly teamAdminUserId: string;
}

async function seedUser(dataSource: DataSource, role: Role): Promise<string> {
  const id = randomUUID();
  await dataSource.query(
    `INSERT INTO "users" ("id", "email", "role", "status") VALUES ($1, $2, $3, 'active')`,
    [id, `user-${id}@example.test`, role],
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
      adminId: await seedUser(dataSource, Role.Admin),
      memberUserId: await seedUser(dataSource, Role.User),
      coachUserId: await seedUser(dataSource, Role.User),
      teamAdminUserId: await seedUser(dataSource, Role.User),
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
  ? 'Member roles authorization matrix (e2e, PostgreSQL)'
  : `Member roles (e2e) (SKIPPED: test database unreachable at ${TEST_DB_HOST}:${TEST_DB_PORT} — start docker-compose.test.yml)`;

describeIfDb(suiteTitle, () => {
  if (!seeded) {
    return;
  }
  const fixture: Fixture = seeded;
  let app: NestFastifyApplication;
  let teamId: string;
  let memberMembershipId: string;
  let accountlessMembershipId: string;
  const otherTeamId = randomUUID();

  function api() {
    return request(app.getHttpServer());
  }

  async function tokenFor(userId: string, roles: Role[]): Promise<string> {
    const tokenPort = app.get<AuthTokenPort>(AUTH_TOKEN_PORT);
    return tokenPort.sign({ userId, email: 'e@example.test', roles });
  }

  async function assignRole(userId: string, roleKey: RbacRole): Promise<void> {
    const role = await fixture.dataSource.query(
      `SELECT "id" FROM "roles" WHERE "key" = $1`,
      [roleKey],
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

  function rolesPath(membershipId: string, team = teamId): string {
    return `/api/v1/teams/${team}/members/${membershipId}/roles`;
  }

  function profileBody() {
    return { fullName: 'Ahmed Hassan', email: 'ahmed@example.test' };
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

    const member = await api()
      .post(`/api/v1/teams/${teamId}/members/invite`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ userId: fixture.memberUserId, profile: profileBody() });
    memberMembershipId = member.body.id;

    const accountless = await api()
      .post(`/api/v1/teams/${teamId}/members/invite`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ profile: profileBody() });
    accountlessMembershipId = accountless.body.id;

    await assignRole(fixture.coachUserId, RbacRole.Coach);
    await assignRole(fixture.teamAdminUserId, RbacRole.TeamAdmin);
  });

  afterAll(async () => {
    await app.close();
    if (seededDataSource) {
      let remaining = MIGRATIONS.length;
      while (remaining > 0) {
        await seededDataSource.undoLastMigration();
        remaining -= 1;
      }
      await seededDataSource.destroy();
    }
    if (ORIGINAL_DATABASE_URL === undefined) {
      delete process.env['DATABASE_URL'];
    } else {
      process.env['DATABASE_URL'] = ORIGINAL_DATABASE_URL;
    }
  });

  it('rejects an unauthenticated read (401)', async () => {
    const response = await api().get(rolesPath(memberMembershipId));

    expect(response.status).toBe(401);
    expect(response.body.messageKey).toBe('errors.auth.tokenRequired');
  });

  it('rejects an unauthenticated write (401)', async () => {
    const response = await api()
      .put(rolesPath(memberMembershipId))
      .send({ roles: ['member'] });

    expect(response.status).toBe(401);
    expect(response.body.messageKey).toBe('errors.auth.tokenRequired');
  });

  it('lets an administrator read the roles and the assignable ceiling', async () => {
    const token = await tokenFor(fixture.adminId, [Role.Admin]);

    const response = await api()
      .get(rolesPath(memberMembershipId))
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.membershipId).toBe(memberMembershipId);
    expect(response.body.roles).toEqual([]);
    expect(response.body.assignableRoles).toEqual(
      expect.arrayContaining(['member', 'coach', 'team_admin']),
    );
  });

  it('forbids a plain member from reading roles (403)', async () => {
    const token = await tokenFor(fixture.memberUserId, [Role.User]);

    const response = await api()
      .get(rolesPath(memberMembershipId))
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(403);
    expect(response.body.messageKey).toBe('errors.auth.permissionDenied');
  });

  it('forbids a plain member from writing roles (403)', async () => {
    const token = await tokenFor(fixture.memberUserId, [Role.User]);

    const response = await api()
      .put(rolesPath(memberMembershipId))
      .set('Authorization', `Bearer ${token}`)
      .send({ roles: ['coach'] });

    expect(response.status).toBe(403);
    expect(response.body.messageKey).toBe('errors.auth.permissionDenied');
  });

  it('denies a scoped coach the write permission in their own team (403)', async () => {
    const token = await tokenFor(fixture.coachUserId, [Role.User]);

    const response = await api()
      .put(rolesPath(memberMembershipId))
      .set('Authorization', `Bearer ${token}`)
      .send({ roles: ['coach'] });

    expect(response.status).toBe(403);
    expect(response.body.messageKey).toBe('errors.auth.permissionDenied');
  });

  it('offers a scoped team admin every team bundle, including scorekeeper', async () => {
    // Regression pin for the audited defect: SCOREKEEPER was missing from the
    // Team Admin's assignable list because TEAM_ADMIN lacked match.score.
    const token = await tokenFor(fixture.teamAdminUserId, [Role.User]);

    const response = await api()
      .get(rolesPath(memberMembershipId))
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.assignableRoles).toEqual([
      'analyst',
      'coach',
      'member',
      'scorekeeper',
      'team_admin',
    ]);
  });

  it('shows a scoped coach only the roles inside their own ceiling', async () => {
    const token = await tokenFor(fixture.coachUserId, [Role.User]);

    const response = await api()
      .get(rolesPath(memberMembershipId))
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.assignableRoles).toContain('member');
    expect(response.body.assignableRoles).not.toContain('team_admin');
  });

  it('replaces the role set and reflects it on the next read', async () => {
    const token = await tokenFor(fixture.adminId, [Role.Admin]);

    const assigned = await api()
      .put(rolesPath(memberMembershipId))
      .set('Authorization', `Bearer ${token}`)
      .send({ roles: ['member', 'coach'] });

    expect(assigned.status).toBe(200);
    expect(assigned.body.roles).toEqual(['coach', 'member']);

    const reread = await api()
      .get(rolesPath(memberMembershipId))
      .set('Authorization', `Bearer ${token}`);

    expect(reread.body.roles).toEqual(['coach', 'member']);
  });

  it('revokes a role that is absent from the replacement set', async () => {
    const token = await tokenFor(fixture.adminId, [Role.Admin]);

    const response = await api()
      .put(rolesPath(memberMembershipId))
      .set('Authorization', `Bearer ${token}`)
      .send({ roles: ['member'] });

    expect(response.status).toBe(200);
    expect(response.body.roles).toEqual(['member']);
  });

  it('refuses to smuggle SUPER_ADMIN through the team roles surface (403)', async () => {
    const token = await tokenFor(fixture.adminId, [Role.Admin]);

    const response = await api()
      .put(rolesPath(memberMembershipId))
      .set('Authorization', `Bearer ${token}`)
      .send({ roles: ['member', 'super_admin'] });

    expect(response.status).toBe(403);
    expect(response.body.messageKey).toBe('errors.rbac.protectedRole');
  });

  it('rejects a role slug outside the seeded catalog (404)', async () => {
    const token = await tokenFor(fixture.adminId, [Role.Admin]);

    const response = await api()
      .put(rolesPath(memberMembershipId))
      .set('Authorization', `Bearer ${token}`)
      .send({ roles: ['superuser'] });

    expect(response.status).toBe(404);
    expect(response.body.messageKey).toBe('errors.rbac.roleNotFound');
  });

  it('refuses to assign roles to a membership with no account (409)', async () => {
    const token = await tokenFor(fixture.adminId, [Role.Admin]);

    const response = await api()
      .put(rolesPath(accountlessMembershipId))
      .set('Authorization', `Bearer ${token}`)
      .send({ roles: ['member'] });

    expect(response.status).toBe(409);
    expect(response.body.messageKey).toBe('errors.members.accountRequired');
  });

  it('never resolves a membership addressed under another team (404)', async () => {
    const token = await tokenFor(fixture.adminId, [Role.Admin]);

    const response = await api()
      .get(rolesPath(memberMembershipId, otherTeamId))
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(404);
    expect(response.body.messageKey).toBe('errors.members.membershipNotFound');
  });

  it('denies a scoped actor reading a member of another team (403)', async () => {
    const token = await tokenFor(fixture.coachUserId, [Role.User]);

    const response = await api()
      .get(rolesPath(memberMembershipId, otherTeamId))
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(403);
    expect(response.body.messageKey).toBe('errors.auth.permissionDenied');
  });

  it('rejects a malformed role payload (400)', async () => {
    const token = await tokenFor(fixture.adminId, [Role.Admin]);

    const response = await api()
      .put(rolesPath(memberMembershipId))
      .set('Authorization', `Bearer ${token}`)
      .send({ roles: 'coach' });

    expect(response.status).toBe(400);
    expect(response.body.messageKey).toBe('errors.validation.failed');
  });
});
