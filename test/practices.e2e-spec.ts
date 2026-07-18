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
import { PlatformSchema1721700000000 } from '../src/database/migrations/1721700000000-platform-schema';
import { PracticesSchema1721800000000 } from '../src/database/migrations/1721800000000-practices-schema';

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

const MIGRATIONS = [
  BaselineSchema1721200000000,
  IdentitySchema1721300000000,
  RbacSchema1721400000000,
  TeamsSchema1721500000000,
  MembersSchema1721600000000,
  PlatformSchema1721700000000,
  PracticesSchema1721800000000,
];

interface Fixture {
  readonly dataSource: DataSource;
  readonly adminId: string;
  readonly memberId: string;
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
      memberId: await seedUser(dataSource, 'active', Role.User),
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
  ? 'Practices authorization matrix (e2e, PostgreSQL)'
  : `Practices (e2e) (SKIPPED: test database unreachable at ${TEST_DB_HOST}:${TEST_DB_PORT} — start docker-compose.test.yml)`;

function scheduleBody(
  overrides: Record<string, unknown>,
): Record<string, unknown> {
  return {
    name: 'Weekly practice',
    sessionType: 'practice',
    frequency: 'weekly',
    weekdays: [1],
    startTimeLocal: '18:00',
    durationMinutes: 90,
    generationStart: '2026-01-05',
    generationUntil: '2026-01-19',
    ...overrides,
  };
}

function sessionBody(
  overrides: Record<string, unknown>,
): Record<string, unknown> {
  return {
    sessionType: 'scrimmage',
    startsAt: '2026-07-15T15:00:00.000Z',
    endsAt: '2026-07-15T17:00:00.000Z',
    ...overrides,
  };
}

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

  async function assignTeamAdmin(
    userId: string,
    scopeTeam: string,
  ): Promise<void> {
    const role = await fixture.dataSource.query(
      `SELECT "id" FROM "roles" WHERE "key" = $1`,
      [RbacRole.TeamAdmin],
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

  function post(path: string, token: string, body: unknown): request.Test {
    return request(app.getHttpServer())
      .post(`/api/v1/teams/${teamId}${path}`)
      .set('Authorization', `Bearer ${token}`)
      .send(body as object);
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

  it('lets a system admin create a practice schedule', async () => {
    const token = await tokenFor(fixture.adminId, [Role.Admin]);
    const response = await post('/practice-schedules', token, scheduleBody({}));
    expect(response.status).toBe(201);
    expect(response.body.status).toBe('active');
    expect(response.body.version).toBe(1);
  });

  it('forbids a plain member from creating a schedule (403)', async () => {
    const token = await tokenFor(fixture.memberId, [Role.User]);
    const response = await post('/practice-schedules', token, scheduleBody({}));
    expect(response.status).toBe(403);
    expect(response.body.messageKey).toBe('errors.auth.permissionDenied');
  });

  it('denies a suspended admin every protected write (403)', async () => {
    const token = await tokenFor(fixture.suspendedAdminId, [Role.Admin]);
    const response = await post('/practice-schedules', token, scheduleBody({}));
    expect(response.status).toBe(403);
    expect(response.body.messageKey).toBe('errors.auth.permissionDenied');
  });

  it('lets a scoped team admin manage their team but denies another (403)', async () => {
    const token = await tokenFor(fixture.teamAdminUserId, [Role.User]);
    const allowed = await post('/practice-schedules', token, scheduleBody({}));
    expect(allowed.status).toBe(201);

    const denied = await request(app.getHttpServer())
      .post(`/api/v1/teams/${otherTeamId}/practice-schedules`)
      .set('Authorization', `Bearer ${token}`)
      .send(scheduleBody({}));
    expect(denied.status).toBe(403);
    expect(denied.body.messageKey).toBe('errors.auth.permissionDenied');
  });

  it('rejects an invalid recurrence (400)', async () => {
    const token = await tokenFor(fixture.adminId, [Role.Admin]);
    const response = await post(
      '/practice-schedules',
      token,
      scheduleBody({ weekdays: [] }),
    );
    expect(response.status).toBe(400);
    expect(response.body.messageKey).toBe('errors.practices.invalidSchedule');
  });

  it('rejects a venue not in the team scope (404)', async () => {
    const token = await tokenFor(fixture.adminId, [Role.Admin]);
    const response = await post(
      '/practice-schedules',
      token,
      scheduleBody({ defaultVenueId: randomUUID() }),
    );
    expect(response.status).toBe(404);
    expect(response.body.messageKey).toBe('errors.practices.venueNotFound');
  });

  it('generates sessions idempotently across repeated runs', async () => {
    const token = await tokenFor(fixture.adminId, [Role.Admin]);
    const schedule = await post('/practice-schedules', token, scheduleBody({}));
    const scheduleId = schedule.body.id;

    const first = await post(
      `/practice-schedules/${scheduleId}/generate`,
      token,
      {},
    );
    expect(first.status).toBe(201);
    expect(first.body.created).toBeGreaterThan(0);

    const second = await post(
      `/practice-schedules/${scheduleId}/generate`,
      token,
      {},
    );
    expect(second.status).toBe(201);
    expect(second.body.created).toBe(0);
    expect(second.body.skipped).toBe(first.body.created);
  });

  it('drives a one-off session through publish, reschedule, cancel, and reopen', async () => {
    const token = await tokenFor(fixture.adminId, [Role.Admin]);
    const created = await post('/practice-sessions', token, sessionBody({}));
    expect(created.status).toBe(201);
    expect(created.body.status).toBe('draft');
    const id = created.body.id;

    const published = await post(`/practice-sessions/${id}/publish`, token, {
      expectedVersion: created.body.version,
    });
    expect(published.status).toBe(201);
    expect(published.body.status).toBe('published');

    const moved = await post(`/practice-sessions/${id}/reschedule`, token, {
      startsAt: '2026-07-20T15:00:00.000Z',
      endsAt: '2026-07-20T17:00:00.000Z',
      expectedVersion: published.body.version,
    });
    expect(moved.status).toBe(201);
    expect(moved.body.status).toBe('rescheduled');

    const cancelled = await post(`/practice-sessions/${id}/cancel`, token, {
      reason: 'weather',
      expectedVersion: moved.body.version,
    });
    expect(cancelled.status).toBe(201);
    expect(cancelled.body.status).toBe('cancelled');
    expect(cancelled.body.cancellationReason).toBe('weather');

    const reopened = await post(`/practice-sessions/${id}/reopen`, token, {
      expectedVersion: cancelled.body.version,
    });
    expect(reopened.status).toBe(201);
    expect(reopened.body.status).toBe('published');

    const history = await request(app.getHttpServer())
      .get(`/api/v1/teams/${teamId}/practice-sessions/${id}/history`)
      .set('Authorization', `Bearer ${token}`);
    expect(history.status).toBe(200);
    expect(history.body.items.length).toBeGreaterThanOrEqual(4);
  });

  it('rejects rescheduling a draft session (409 invalid transition)', async () => {
    const token = await tokenFor(fixture.adminId, [Role.Admin]);
    const created = await post('/practice-sessions', token, sessionBody({}));
    const response = await post(
      `/practice-sessions/${created.body.id}/reschedule`,
      token,
      {
        startsAt: '2026-07-20T15:00:00.000Z',
        endsAt: '2026-07-20T17:00:00.000Z',
        expectedVersion: created.body.version,
      },
    );
    expect(response.status).toBe(409);
    expect(response.body.messageKey).toBe('errors.practices.invalidTransition');
  });

  it('reports a version conflict on a stale publish (409)', async () => {
    const token = await tokenFor(fixture.adminId, [Role.Admin]);
    const created = await post('/practice-sessions', token, sessionBody({}));
    const response = await post(
      `/practice-sessions/${created.body.id}/publish`,
      token,
      { expectedVersion: 999 },
    );
    expect(response.status).toBe(409);
    expect(response.body.messageKey).toBe('errors.practices.versionConflict');
  });

  it('returns 404 for a session in the wrong team scope', async () => {
    const token = await tokenFor(fixture.adminId, [Role.Admin]);
    const response = await post(
      `/practice-sessions/${randomUUID()}/publish`,
      token,
      { expectedVersion: 1 },
    );
    expect(response.status).toBe(404);
    expect(response.body.messageKey).toBe('errors.practices.sessionNotFound');
  });

  it('rejects a malformed session id (400 invalid uuid)', async () => {
    const token = await tokenFor(fixture.adminId, [Role.Admin]);
    const response = await request(app.getHttpServer())
      .get(`/api/v1/teams/${teamId}/practice-sessions/not-a-uuid`)
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(400);
    expect(response.body.messageKey).toBe('errors.validation.invalidUuid');
  });

  it('lets any authenticated member read the calendar (practice.read)', async () => {
    const token = await tokenFor(fixture.memberId, [Role.User]);
    const response = await request(app.getHttpServer())
      .get(`/api/v1/teams/${teamId}/practice-sessions`)
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.items)).toBe(true);
  });
});
