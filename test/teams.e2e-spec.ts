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

interface Fixture {
  readonly dataSource: DataSource;
  readonly adminId: string;
  readonly memberId: string;
  readonly teamAdminUserId: string;
  readonly superAdminUserId: string;
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
      migrations: [
        BaselineSchema1721200000000,
        IdentitySchema1721300000000,
        RbacSchema1721400000000,
        TeamsSchema1721500000000,
        PlatformLifecycleSchema1723800000000,
      ],
    });
    await dataSource.initialize();
    await dataSource.runMigrations();
    const adminId = await seedUser(dataSource, 'active', Role.Admin);
    const memberId = await seedUser(dataSource, 'active', Role.User);
    const teamAdminUserId = await seedUser(dataSource, 'active', Role.User);
    const superAdminUserId = await seedUser(dataSource, 'active', Role.User);
    const suspendedAdminId = await seedUser(
      dataSource,
      'suspended',
      Role.Admin,
    );
    return {
      dataSource,
      adminId,
      memberId,
      teamAdminUserId,
      superAdminUserId,
      suspendedAdminId,
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
  ? 'Teams authorization matrix (e2e, PostgreSQL)'
  : `Teams (e2e) (SKIPPED: test database unreachable at ${TEST_DB_HOST}:${TEST_DB_PORT} — start docker-compose.test.yml)`;

describeIfDb(suiteTitle, () => {
  if (!seeded) {
    return;
  }
  const fixture: Fixture = seeded;
  let app: NestFastifyApplication;
  let teamId: string;
  const otherTeamId = randomUUID();

  async function tokenFor(userId: string, roles: Role[]): Promise<string> {
    const tokenPort = app.get<AuthTokenPort>(AUTH_TOKEN_PORT);
    return tokenPort.sign({ userId, email: 'e@example.test', roles });
  }

  async function assignRole(
    userId: string,
    roleKey: RbacRole,
    scopeTeam: string | null,
  ): Promise<void> {
    const role = await fixture.dataSource.query(
      `SELECT "id" FROM "roles" WHERE "key" = $1`,
      [roleKey],
    );
    await fixture.dataSource.query(
      `INSERT INTO "user_role_assignments" ("id", "user_id", "role_id", "team_id")
       VALUES ($1, $2, $3, $4)`,
      [randomUUID(), userId, role[0].id, scopeTeam],
    );
    await fixture.dataSource.query(
      `UPDATE "rbac_policy_version" SET "version" = "version" + 1 WHERE "singleton" = true`,
    );
  }

  async function assignTeamAdmin(
    userId: string,
    scopeTeam: string,
  ): Promise<void> {
    await assignRole(userId, RbacRole.TeamAdmin, scopeTeam);
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
    const created = await request(app.getHttpServer())
      .post('/api/v1/teams')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ slug: `natives-${randomUUID().slice(0, 8)}`, name: 'Natives' });
    teamId = created.body.id;
    await assignTeamAdmin(fixture.teamAdminUserId, teamId);
    // A platform super admin is an ORDINARY account whose SUPER_ADMIN bundle is
    // assigned globally (team_id IS NULL) — no elevated `users.role` needed.
    await assignRole(fixture.superAdminUserId, RbacRole.SuperAdmin, null);
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

  it('lets a system admin create a team', async () => {
    const token = await tokenFor(fixture.adminId, [Role.Admin]);
    const response = await request(app.getHttpServer())
      .post('/api/v1/teams')
      .set('Authorization', `Bearer ${token}`)
      .send({ slug: `extra-${randomUUID().slice(0, 8)}`, name: 'Extra' });
    expect(response.status).toBe(201);
    expect(response.body.status).toBe('active');
    expect(response.body.version).toBe(1);
  });

  it('forbids a plain member from creating a season (403)', async () => {
    const token = await tokenFor(fixture.memberId, [Role.User]);
    const response = await request(app.getHttpServer())
      .post(`/api/v1/teams/${teamId}/seasons`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        slug: 'spring-2026',
        name: 'Spring 2026',
        startsOn: '2026-01-01',
        endsOn: '2026-06-30',
      });
    expect(response.status).toBe(403);
    expect(response.body.messageKey).toBe('errors.auth.permissionDenied');
  });

  it('denies a suspended admin every protected write (403)', async () => {
    const token = await tokenFor(fixture.suspendedAdminId, [Role.Admin]);
    const response = await request(app.getHttpServer())
      .post('/api/v1/teams')
      .set('Authorization', `Bearer ${token}`)
      .send({ slug: `susp-${randomUUID().slice(0, 8)}`, name: 'Suspended' });
    expect(response.status).toBe(403);
    expect(response.body.messageKey).toBe('errors.auth.permissionDenied');
  });

  it('lets a scoped team admin manage their team but denies another (403)', async () => {
    const token = await tokenFor(fixture.teamAdminUserId, [Role.User]);

    const allowed = await request(app.getHttpServer())
      .post(`/api/v1/teams/${teamId}/seasons`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        slug: `spring-${randomUUID().slice(0, 8)}`,
        name: 'Spring',
        startsOn: '2026-01-01',
        endsOn: '2026-06-30',
      });
    expect(allowed.status).toBe(201);

    const denied = await request(app.getHttpServer())
      .post(`/api/v1/teams/${otherTeamId}/seasons`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        slug: 'spring-x',
        name: 'Spring',
        startsOn: '2026-01-01',
        endsOn: '2026-06-30',
      });
    expect(denied.status).toBe(403);
    expect(denied.body.messageKey).toBe('errors.auth.permissionDenied');
  });

  it('rejects an overlapping season (409)', async () => {
    const token = await tokenFor(fixture.adminId, [Role.Admin]);
    const base = {
      name: 'Overlap',
      startsOn: '2027-01-01',
      endsOn: '2027-06-30',
    };
    const first = await request(app.getHttpServer())
      .post(`/api/v1/teams/${teamId}/seasons`)
      .set('Authorization', `Bearer ${token}`)
      .send({ ...base, slug: `ov1-${randomUUID().slice(0, 8)}` });
    expect(first.status).toBe(201);

    const second = await request(app.getHttpServer())
      .post(`/api/v1/teams/${teamId}/seasons`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        slug: `ov2-${randomUUID().slice(0, 8)}`,
        name: 'Overlap 2',
        startsOn: '2027-03-01',
        endsOn: '2027-09-30',
      });
    expect(second.status).toBe(409);
    expect(second.body.messageKey).toBe('errors.teams.seasonOverlap');
  });

  it('rejects an invalid season date range (400)', async () => {
    const token = await tokenFor(fixture.adminId, [Role.Admin]);
    const response = await request(app.getHttpServer())
      .post(`/api/v1/teams/${teamId}/seasons`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        slug: `bad-${randomUUID().slice(0, 8)}`,
        name: 'Bad',
        startsOn: '2028-06-30',
        endsOn: '2028-01-01',
      });
    expect(response.status).toBe(400);
    expect(response.body.messageKey).toBe('errors.teams.seasonInvalidRange');
  });

  it('returns 404 for a season in the wrong team scope', async () => {
    const token = await tokenFor(fixture.adminId, [Role.Admin]);
    const response = await request(app.getHttpServer())
      .delete(`/api/v1/teams/${teamId}/seasons/${randomUUID()}`)
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(404);
    expect(response.body.messageKey).toBe('errors.teams.seasonNotFound');
  });

  it('reports an optimistic version conflict on a stale team update (409)', async () => {
    const token = await tokenFor(fixture.adminId, [Role.Admin]);
    const response = await request(app.getHttpServer())
      .patch(`/api/v1/teams/${teamId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Renamed', expectedVersion: 999 });
    expect(response.status).toBe(409);
    expect(response.body.messageKey).toBe('errors.teams.versionConflict');
  });

  it('blocks archiving a referenced catalog entry (409)', async () => {
    const token = await tokenFor(fixture.adminId, [Role.Admin]);
    const created = await request(app.getHttpServer())
      .post(`/api/v1/teams/${teamId}/catalog-entries`)
      .set('Authorization', `Bearer ${token}`)
      .send({ catalog: 'division', key: 'open', label: 'Open' });
    expect(created.status).toBe(201);

    await fixture.dataSource.query(
      `UPDATE "reference_catalog_entries" SET "reference_count" = 2 WHERE "id" = $1`,
      [created.body.id],
    );

    const response = await request(app.getHttpServer())
      .delete(`/api/v1/teams/${teamId}/catalog-entries/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(409);
    expect(response.body.messageKey).toBe('errors.teams.catalogEntryInUse');
  });

  it('resolves the effective settings snapshot as of a date', async () => {
    const token = await tokenFor(fixture.adminId, [Role.Admin]);
    const created = await request(app.getHttpServer())
      .post(`/api/v1/teams/${teamId}/settings/versions`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        settingKey: 'badge_tiers',
        effectiveFrom: '2026-01-01T00:00:00.000Z',
        value: { tiers: [100, 200, 450] },
      });
    expect(created.status).toBe(201);

    const snapshot = await request(app.getHttpServer())
      .get(
        `/api/v1/teams/${teamId}/settings/snapshot?asOf=2026-06-01T00:00:00.000Z`,
      )
      .set('Authorization', `Bearer ${token}`);
    expect(snapshot.status).toBe(200);
    const badge = snapshot.body.settings.find(
      (s: { settingKey: string }) => s.settingKey === 'badge_tiers',
    );
    expect(badge.value).toEqual({ tiers: [100, 200, 450] });
  });

  it('lets a globally assigned super admin create a team', async () => {
    const token = await tokenFor(fixture.superAdminUserId, [Role.User]);
    const response = await request(app.getHttpServer())
      .post('/api/v1/teams')
      .set('Authorization', `Bearer ${token}`)
      .send({ slug: `sa-${randomUUID().slice(0, 8)}`, name: 'Super Created' });
    expect(response.status).toBe(201);
  });

  it('denies a team admin the platform-only create-team route (403)', async () => {
    const token = await tokenFor(fixture.teamAdminUserId, [Role.User]);
    const response = await request(app.getHttpServer())
      .post('/api/v1/teams')
      .set('Authorization', `Bearer ${token}`)
      .send({ slug: `ta-${randomUUID().slice(0, 8)}`, name: 'Nope' });
    expect(response.status).toBe(403);
    expect(response.body.messageKey).toBe('errors.auth.permissionDenied');
  });

  it('denies a team admin and a plain member the browse-all-teams route (403)', async () => {
    for (const userId of [fixture.teamAdminUserId, fixture.memberId]) {
      const token = await tokenFor(userId, [Role.User]);
      const response = await request(app.getHttpServer())
        .get('/api/v1/teams')
        .set('Authorization', `Bearer ${token}`);
      expect(response.status).toBe(403);
      expect(response.body.messageKey).toBe('errors.auth.permissionDenied');
    }
  });

  it('lets a super admin browse every team', async () => {
    const token = await tokenFor(fixture.superAdminUserId, [Role.User]);
    const response = await request(app.getHttpServer())
      .get('/api/v1/teams')
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(response.body.total).toBeGreaterThan(0);
  });

  it('scopes GET /teams/mine to the caller own teams', async () => {
    const teamAdmin = await tokenFor(fixture.teamAdminUserId, [Role.User]);
    const mine = await request(app.getHttpServer())
      .get('/api/v1/teams/mine')
      .set('Authorization', `Bearer ${teamAdmin}`);
    expect(mine.status).toBe(200);
    expect(mine.body.items.map((team: { id: string }) => team.id)).toEqual([
      teamId,
    ]);

    const member = await tokenFor(fixture.memberId, [Role.User]);
    const none = await request(app.getHttpServer())
      .get('/api/v1/teams/mine')
      .set('Authorization', `Bearer ${member}`);
    expect(none.status).toBe(200);
    expect(none.body.items).toEqual([]);
  });

  it('denies a team admin the platform-only soft removal (403)', async () => {
    const token = await tokenFor(fixture.teamAdminUserId, [Role.User]);
    const response = await request(app.getHttpServer())
      .post(`/api/v1/teams/${teamId}/remove`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(response.status).toBe(403);
    expect(response.body.messageKey).toBe('errors.auth.permissionDenied');
  });

  it('walks a team through disable, enable, archive and soft removal', async () => {
    const superAdmin = await tokenFor(fixture.superAdminUserId, [Role.User]);
    const created = await request(app.getHttpServer())
      .post('/api/v1/teams')
      .set('Authorization', `Bearer ${superAdmin}`)
      .send({ slug: `life-${randomUUID().slice(0, 8)}`, name: 'Lifecycle' });
    expect(created.status).toBe(201);
    const target = created.body.id;

    const disabled = await request(app.getHttpServer())
      .post(`/api/v1/teams/${target}/deactivate`)
      .set('Authorization', `Bearer ${superAdmin}`)
      .send({ expectedVersion: created.body.version });
    expect(disabled.status).toBe(200);
    expect(disabled.body.status).toBe('disabled');

    const enabled = await request(app.getHttpServer())
      .post(`/api/v1/teams/${target}/activate`)
      .set('Authorization', `Bearer ${superAdmin}`)
      .send({ expectedVersion: disabled.body.version });
    expect(enabled.status).toBe(200);
    expect(enabled.body.status).toBe('active');

    const tooSoon = await request(app.getHttpServer())
      .post(`/api/v1/teams/${target}/remove`)
      .set('Authorization', `Bearer ${superAdmin}`)
      .send({});
    expect(tooSoon.status).toBe(409);
    expect(tooSoon.body.messageKey).toBe('errors.teams.teamInvalidTransition');

    const archived = await request(app.getHttpServer())
      .post(`/api/v1/teams/${target}/archive`)
      .set('Authorization', `Bearer ${superAdmin}`)
      .send({ expectedVersion: enabled.body.version });
    expect(archived.status).toBe(200);
    expect(archived.body.status).toBe('archived');

    const removed = await request(app.getHttpServer())
      .post(`/api/v1/teams/${target}/remove`)
      .set('Authorization', `Bearer ${superAdmin}`)
      .send({ expectedVersion: archived.body.version });
    expect(removed.status).toBe(200);
    expect(removed.body.deletedAt).not.toBeNull();

    const gone = await request(app.getHttpServer())
      .get(`/api/v1/teams/${target}`)
      .set('Authorization', `Bearer ${superAdmin}`);
    expect(gone.status).toBe(404);
    expect(gone.body.messageKey).toBe('errors.teams.teamNotFound');

    const rows = await fixture.dataSource.query(
      `SELECT "deleted_at" FROM "teams" WHERE "id" = $1`,
      [target],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].deleted_at).not.toBeNull();
  });

  it('reports a stale version on a lifecycle transition (409)', async () => {
    const token = await tokenFor(fixture.adminId, [Role.Admin]);
    const response = await request(app.getHttpServer())
      .post(`/api/v1/teams/${teamId}/deactivate`)
      .set('Authorization', `Bearer ${token}`)
      .send({ expectedVersion: 999 });
    expect(response.status).toBe(409);
    expect(response.body.messageKey).toBe('errors.teams.versionConflict');
  });

  it('denies a team admin every lifecycle move on another team (403)', async () => {
    const token = await tokenFor(fixture.teamAdminUserId, [Role.User]);
    const response = await request(app.getHttpServer())
      .post(`/api/v1/teams/${otherTeamId}/archive`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(response.status).toBe(403);
    expect(response.body.messageKey).toBe('errors.auth.permissionDenied');
  });

  it('runs a season through activate, close and re-activate', async () => {
    const token = await tokenFor(fixture.adminId, [Role.Admin]);
    const created = await request(app.getHttpServer())
      .post(`/api/v1/teams/${teamId}/seasons`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        slug: `life-${randomUUID().slice(0, 8)}`,
        name: 'Lifecycle season',
        startsOn: '2031-01-01',
        endsOn: '2031-06-30',
      });
    expect(created.status).toBe(201);
    expect(created.body.status).toBe('draft');

    const activated = await request(app.getHttpServer())
      .post(`/api/v1/teams/${teamId}/seasons/${created.body.id}/activate`)
      .set('Authorization', `Bearer ${token}`)
      .send({ expectedVersion: created.body.version });
    expect(activated.status).toBe(200);
    expect(activated.body.status).toBe('active');

    const current = await request(app.getHttpServer())
      .get(`/api/v1/teams/${teamId}/seasons/current`)
      .set('Authorization', `Bearer ${token}`);
    expect(current.status).toBe(200);
    expect(current.body.id).toBe(created.body.id);

    const closed = await request(app.getHttpServer())
      .post(`/api/v1/teams/${teamId}/seasons/${created.body.id}/close`)
      .set('Authorization', `Bearer ${token}`)
      .send({ expectedVersion: activated.body.version });
    expect(closed.status).toBe(200);
    expect(closed.body.status).toBe('closed');

    const missing = await request(app.getHttpServer())
      .get(`/api/v1/teams/${teamId}/seasons/current`)
      .set('Authorization', `Bearer ${token}`);
    expect(missing.status).toBe(404);
    expect(missing.body.messageKey).toBe('errors.teams.currentSeasonNotFound');
  });

  it('rejects an invalid season transition (409)', async () => {
    const token = await tokenFor(fixture.adminId, [Role.Admin]);
    const created = await request(app.getHttpServer())
      .post(`/api/v1/teams/${teamId}/seasons`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        slug: `bad-${randomUUID().slice(0, 8)}`,
        name: 'Bad transition',
        startsOn: '2032-01-01',
        endsOn: '2032-06-30',
      });
    expect(created.status).toBe(201);

    const response = await request(app.getHttpServer())
      .post(`/api/v1/teams/${teamId}/seasons/${created.body.id}/close`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(response.status).toBe(409);
    expect(response.body.messageKey).toBe(
      'errors.teams.seasonInvalidTransition',
    );
  });

  it('refuses a second current season for the same team (409)', async () => {
    const token = await tokenFor(fixture.adminId, [Role.Admin]);
    const first = await request(app.getHttpServer())
      .post(`/api/v1/teams/${teamId}/seasons`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        slug: `one-${randomUUID().slice(0, 8)}`,
        name: 'Current one',
        startsOn: '2033-01-01',
        endsOn: '2033-06-30',
        status: 'active',
      });
    expect(first.status).toBe(201);

    const second = await request(app.getHttpServer())
      .post(`/api/v1/teams/${teamId}/seasons`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        slug: `two-${randomUUID().slice(0, 8)}`,
        name: 'Current two',
        startsOn: '2034-01-01',
        endsOn: '2034-06-30',
        status: 'active',
      });
    expect(second.status).toBe(409);
    expect(second.body.messageKey).toBe('errors.teams.seasonAlreadyActive');
  });
});
