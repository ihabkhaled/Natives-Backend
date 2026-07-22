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
import { PlatformLifecycleSchema1723800000000 } from '../src/database/migrations/1723800000000-platform-lifecycle-schema';
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

const MEMBER_ROLE_KEY: string = RbacRole.Member;
const TEAM_A = randomUUID();
const TEAM_B = randomUUID();

const MIGRATIONS = [
  BaselineSchema1721200000000,
  IdentitySchema1721300000000,
  RbacSchema1721400000000,
  TeamsSchema1721500000000,
  PlatformLifecycleSchema1723800000000,
  RbacRoleCatalogMetadata1725000000000,
];

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
      migrations: MIGRATIONS,
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

  it('serves the whole role x permission matrix from the seeded tables', async () => {
    const token = await tokenFor(fixture.adminId, [Role.Admin]);

    const response = await request(app.getHttpServer())
      .get('/api/v1/rbac/role-bundles')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.policyVersion).toBeGreaterThan(0);

    const permissionKeys = response.body.permissions.map(
      (entry: { key: string }) => entry.key,
    );
    expect(permissionKeys).toContain('team.read');
    // Deterministic ordering: area first, then key within the area.
    const ordering = response.body.permissions.map(
      (entry: { area: string; key: string }) => `${entry.area} ${entry.key}`,
    );
    expect(ordering).toEqual([...ordering].sort());

    const roleKeys = response.body.roles.map(
      (role: { key: string }) => role.key,
    );
    expect(roleKeys).toEqual([...roleKeys].sort());
    for (const key of [
      RbacRole.Member,
      RbacRole.Coach,
      RbacRole.TeamAdmin,
      RbacRole.Scorekeeper,
      RbacRole.Analyst,
    ]) {
      expect(roleKeys).toContain(key);
    }

    const member = response.body.roles.find(
      (role: { key: string }) => role.key === MEMBER_ROLE_KEY,
    );
    expect(member.isSystem).toBe(true);
    expect(member.permissions).toContain('team.read');
    expect(member.permissions).not.toContain('member.roles.manage');
  });

  it('denies the matrix to a principal without member.roles.manage (403)', async () => {
    const token = await tokenFor(fixture.memberId, [Role.User]);

    const response = await request(app.getHttpServer())
      .get('/api/v1/rbac/role-bundles')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(403);
    expect(response.body.messageKey).toBe('errors.auth.permissionDenied');
  });

  it('rejects an unauthenticated matrix read (401)', async () => {
    const response = await request(app.getHttpServer()).get(
      '/api/v1/rbac/role-bundles',
    );

    expect(response.status).toBe(401);
    expect(response.body.messageKey).toBe('errors.auth.tokenRequired');
  });

  it('lets a team-scoped admin read the matrix within their team scope only', async () => {
    const token = await tokenFor(fixture.teamAdminUserId, [Role.User]);

    const scoped = await request(app.getHttpServer())
      .get(`/api/v1/rbac/role-bundles?teamId=${TEAM_A}`)
      .set('Authorization', `Bearer ${token}`);
    expect(scoped.status).toBe(200);
    expect(scoped.body.roles.length).toBeGreaterThan(0);

    const unscoped = await request(app.getHttpServer())
      .get('/api/v1/rbac/role-bundles')
      .set('Authorization', `Bearer ${token}`);
    expect(unscoped.status).toBe(403);
    expect(unscoped.body.messageKey).toBe('errors.auth.permissionDenied');
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

  // --- assignable-roles catalog ----------------------------------------------

  it('projects the team admin assignable catalog with display metadata', async () => {
    const token = await tokenFor(fixture.teamAdminUserId, [Role.User]);

    const response = await request(app.getHttpServer())
      .get(`/api/v1/rbac/teams/${TEAM_A}/assignable-roles`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.teamId).toBe(TEAM_A);
    const slugs = response.body.roles.map(
      (role: { slug: string }) => role.slug,
    );
    // The seeded SCOREKEEPER bundle carries match.score, which TEAM_ADMIN
    // lacks, so it stays above the ceiling; SUPER_ADMIN is structurally
    // excluded by the catalog metadata regardless of any ceiling.
    expect(slugs).toEqual(['analyst', 'coach', 'member', 'team_admin']);
    for (const role of response.body.roles as {
      displayName: string;
      description: string;
    }[]) {
      expect(role.displayName.length).toBeGreaterThan(0);
      expect(role.description.length).toBeGreaterThan(0);
    }
  });

  it('denies the assignable catalog to a coach who cannot invite (403)', async () => {
    // The seeded COACH bundle carries no member.invite, so the route guard —
    // not the ceiling — is what stops a coach from browsing the catalog.
    const coachUserId = await newTarget();
    const role = await fixture.dataSource.query(
      `SELECT "id" FROM "roles" WHERE "key" = $1`,
      [RbacRole.Coach],
    );
    await fixture.dataSource.query(
      `INSERT INTO "user_role_assignments" ("id", "user_id", "role_id", "team_id")
       VALUES ($1, $2, $3, $4)`,
      [randomUUID(), coachUserId, role[0].id, TEAM_A],
    );
    await fixture.dataSource.query(
      `UPDATE "rbac_policy_version" SET "version" = "version" + 1 WHERE "singleton" = true`,
    );
    const token = await tokenFor(coachUserId, [Role.User]);

    const response = await request(app.getHttpServer())
      .get(`/api/v1/rbac/teams/${TEAM_A}/assignable-roles`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(403);
    expect(response.body.messageKey).toBe('errors.auth.permissionDenied');
  });

  it('denies the assignable catalog outside the actor team scope (403)', async () => {
    const token = await tokenFor(fixture.teamAdminUserId, [Role.User]);

    const response = await request(app.getHttpServer())
      .get(`/api/v1/rbac/teams/${TEAM_B}/assignable-roles`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(403);
    expect(response.body.messageKey).toBe('errors.auth.permissionDenied');
  });

  it('denies the assignable catalog to a member without member.invite (403)', async () => {
    const token = await tokenFor(fixture.memberId, [Role.User]);

    const response = await request(app.getHttpServer())
      .get(`/api/v1/rbac/teams/${TEAM_A}/assignable-roles`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(403);
    expect(response.body.messageKey).toBe('errors.auth.permissionDenied');
  });

  // --- protected roles in team scope -----------------------------------------

  it('refuses a team-scoped assignment of SUPER_ADMIN even to a system admin', async () => {
    const token = await tokenFor(fixture.adminId, [Role.Admin]);
    const target = await newTarget();

    const response = await request(app.getHttpServer())
      .post(`/api/v1/rbac/assignments?teamId=${TEAM_A}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ userId: target, roleKey: RbacRole.SuperAdmin });

    expect(response.status).toBe(403);
    expect(response.body.messageKey).toBe('errors.rbac.protectedRole');
  });

  // --- platform super-admin management ---------------------------------------

  it('promotes, lists, and revokes super admins with audit and last-admin guard', async () => {
    const adminToken = await tokenFor(fixture.adminId, [Role.Admin]);
    const first = await newTarget();
    const second = await newTarget();
    const reason = 'Founding operator handover';

    const promoted = await request(app.getHttpServer())
      .post('/api/v1/rbac/platform/super-admins')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ userId: first, reason });
    expect(promoted.status).toBe(201);
    expect(promoted.body).toMatchObject({
      userId: first,
      grantedBy: fixture.adminId,
    });

    // Idempotent: promoting the same user again returns the live assignment.
    const again = await request(app.getHttpServer())
      .post('/api/v1/rbac/platform/super-admins')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ userId: first, reason });
    expect(again.status).toBe(201);
    expect(again.body.assignmentId).toBe(promoted.body.assignmentId);

    const secondPromoted = await request(app.getHttpServer())
      .post('/api/v1/rbac/platform/super-admins')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ userId: second, reason });
    expect(secondPromoted.status).toBe(201);

    const listed = await request(app.getHttpServer())
      .get('/api/v1/rbac/platform/super-admins')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(listed.status).toBe(200);
    expect(listed.body.total).toBe(2);
    expect(
      listed.body.items.map((entry: { userId: string }) => entry.userId),
    ).toEqual(expect.arrayContaining([first, second]));

    const revoked = await request(app.getHttpServer())
      .delete(`/api/v1/rbac/platform/super-admins/${second}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Left the organization' });
    expect(revoked.status).toBe(200);
    expect(revoked.body.userId).toBe(second);

    // The last live super admin can never be removed — 409, not a lockout.
    const lastRevoke = await request(app.getHttpServer())
      .delete(`/api/v1/rbac/platform/super-admins/${first}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Attempted lockout' });
    expect(lastRevoke.status).toBe(409);
    expect(lastRevoke.body.messageKey).toBe('errors.rbac.lastSuperAdmin');

    // Both changes are audited with actor, target, and the mandatory reason.
    const audits = await fixture.dataSource.query(
      `SELECT "event_type", "actor_user_id", "context" FROM "security_events"
        WHERE "event_type" IN ('rbac.superAdminPromoted', 'rbac.superAdminRevoked')
        ORDER BY "occurred_at" ASC`,
    );
    expect(audits.length).toBeGreaterThanOrEqual(3);
    const promotedAudit = audits.find(
      (row: { context: { targetUserId: string } }) =>
        row.context.targetUserId === first,
    );
    expect(promotedAudit.actor_user_id).toBe(fixture.adminId);
    expect(promotedAudit.context.reason).toBe(reason);

    // Cleanup: revoke the remaining super admin against a re-promoted second
    // so later assertions never inherit surprise global grants.
    await request(app.getHttpServer())
      .post('/api/v1/rbac/platform/super-admins')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ userId: second, reason });
    await request(app.getHttpServer())
      .delete(`/api/v1/rbac/platform/super-admins/${first}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'cleanup rotation' });
  });

  it('rejects promoting an inactive user (409) and an unknown revoke (404)', async () => {
    const adminToken = await tokenFor(fixture.adminId, [Role.Admin]);

    const inactive = await request(app.getHttpServer())
      .post('/api/v1/rbac/platform/super-admins')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ userId: fixture.inactiveAdminId, reason: 'Should never work' });
    expect(inactive.status).toBe(409);
    expect(inactive.body.messageKey).toBe('errors.rbac.userNotEligible');

    const unknown = await request(app.getHttpServer())
      .delete(`/api/v1/rbac/platform/super-admins/${randomUUID()}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'No such holder' });
    expect(unknown.status).toBe(404);
    expect(unknown.body.messageKey).toBe('errors.rbac.assignmentNotFound');
  });

  it('requires the audited reason on promotion (400)', async () => {
    const adminToken = await tokenFor(fixture.adminId, [Role.Admin]);
    const target = await newTarget();

    const response = await request(app.getHttpServer())
      .post('/api/v1/rbac/platform/super-admins')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ userId: target });

    expect(response.status).toBe(400);
    expect(response.body.messageKey).toBe('errors.validation.failed');
  });

  it('denies the platform routes to holders of mere team authority (403)', async () => {
    const teamAdminToken = await tokenFor(fixture.teamAdminUserId, [Role.User]);
    const memberToken = await tokenFor(fixture.memberId, [Role.User]);

    for (const token of [teamAdminToken, memberToken]) {
      const listed = await request(app.getHttpServer())
        .get('/api/v1/rbac/platform/super-admins')
        .set('Authorization', `Bearer ${token}`);
      expect(listed.status).toBe(403);
      expect(listed.body.messageKey).toBe('errors.auth.permissionDenied');
    }
  });
});
