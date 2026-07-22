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
import { PlatformLifecycleSchema1723800000000 } from '../src/database/migrations/1723800000000-platform-lifecycle-schema';
import { JobHeartbeats1725200000000 } from '../src/database/migrations/1725200000000-job-heartbeats';
import { OutboxDeadLetterTimestamp1725300000000 } from '../src/database/migrations/1725300000000-outbox-dead-letter-timestamp';

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
  PlatformSchema1721700000000,
  PlatformLifecycleSchema1723800000000,
  JobHeartbeats1725200000000,
  OutboxDeadLetterTimestamp1725300000000,
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
  ? 'Platform authorization matrix (e2e, PostgreSQL)'
  : `Platform (e2e) (SKIPPED: test database unreachable at ${TEST_DB_HOST}:${TEST_DB_PORT} — start docker-compose.test.yml)`;

describeIfDb(suiteTitle, () => {
  if (!seeded) {
    return;
  }
  const fixture: Fixture = seeded;
  let app: NestFastifyApplication;
  let teamId: string;
  let notificationId: string;
  let deadEventId: string;
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

  async function seedNotification(): Promise<string> {
    const id = randomUUID();
    await fixture.dataSource.query(
      `INSERT INTO "notifications" ("id", "user_id", "team_id", "category",
              "event_type", "title_key", "body_key", "params", "dedupe_key")
       VALUES ($1, $2, $3, 'member_lifecycle', 'member.invited',
               'notifications.member.invited.title',
               'notifications.member.invited.body', '{}'::jsonb, $4)`,
      [id, fixture.memberUserId, teamId, `dedupe-${id}`],
    );
    return id;
  }

  async function seedAudit(): Promise<void> {
    await fixture.dataSource.query(
      `INSERT INTO "audit_log" ("id", "actor_user_id", "action",
              "resource_type", "resource_id", "team_id", "outcome", "diff")
       VALUES ($1, $2, 'member.invited', 'membership', 'mem-1', $3,
               'success', '{}'::jsonb)`,
      [randomUUID(), fixture.adminId, teamId],
    );
  }

  async function seedDeadEvent(): Promise<string> {
    const id = randomUUID();
    await fixture.dataSource.query(
      `INSERT INTO "outbox_events" ("id", "aggregate_type", "aggregate_id",
              "event_type", "event_version", "payload", "status", "attempts")
       VALUES ($1, 'membership', 'mem-1', 'member.invited', 1, '{}'::jsonb,
               'dead_lettered', 5)`,
      [id],
    );
    return id;
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
    notificationId = await seedNotification();
    await seedAudit();
    deadEventId = await seedDeadEvent();
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

  // --- notifications (self) ---------------------------------------------------

  it('lets a member list their own notifications', async () => {
    const token = await tokenFor(fixture.memberUserId, [Role.User]);
    const response = await api()
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(response.body.total).toBeGreaterThanOrEqual(1);
    expect(response.body.items[0]).not.toHaveProperty('dedupeKey');
  });

  it('rejects an unauthenticated inbox read (401)', async () => {
    const response = await api().get('/api/v1/notifications');
    expect(response.status).toBe(401);
    expect(response.body.messageKey).toBe('errors.auth.tokenRequired');
  });

  it('forbids a caller without notification permission (403)', async () => {
    const token = await tokenFor(fixture.memberUserId, []);
    const response = await api()
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(403);
    expect(response.body.messageKey).toBe('errors.auth.permissionDenied');
  });

  it('lets a member mark their own notification read', async () => {
    const token = await tokenFor(fixture.memberUserId, [Role.User]);
    const response = await api()
      .post(`/api/v1/notifications/${notificationId}/read`)
      .set('Authorization', `Bearer ${token}`)
      .send();
    expect(response.status).toBe(200);
    expect(response.body.readAt).not.toBeNull();
  });

  it('returns 404 marking a notification the member does not own', async () => {
    const token = await tokenFor(fixture.memberUserId, [Role.User]);
    const response = await api()
      .post(`/api/v1/notifications/${randomUUID()}/read`)
      .set('Authorization', `Bearer ${token}`)
      .send();
    expect(response.status).toBe(404);
    expect(response.body.messageKey).toBe(
      'errors.platform.notificationNotFound',
    );
  });

  it('reads and updates the member notification preferences', async () => {
    const token = await tokenFor(fixture.memberUserId, [Role.User]);
    const read = await api()
      .get('/api/v1/notifications/preferences')
      .set('Authorization', `Bearer ${token}`);
    expect(read.status).toBe(200);

    const update = await api()
      .put('/api/v1/notifications/preferences')
      .set('Authorization', `Bearer ${token}`)
      .send({ category: 'practice', channel: 'in_app', enabled: false });
    expect(update.status).toBe(200);
    expect(update.body.items).toHaveLength(1);
  });

  it('rejects an invalid preference body (400)', async () => {
    const token = await tokenFor(fixture.memberUserId, [Role.User]);
    const response = await api()
      .put('/api/v1/notifications/preferences')
      .set('Authorization', `Bearer ${token}`)
      .send({ category: 'not-a-category', channel: 'in_app', enabled: true });
    expect(response.status).toBe(400);
    expect(response.body.messageKey).toBe('errors.validation.failed');
  });

  // --- audit (team-scoped) ----------------------------------------------------

  it('lets a system admin read the team audit ledger', async () => {
    const token = await tokenFor(fixture.adminId, [Role.Admin]);
    const response = await api()
      .get(`/api/v1/teams/${teamId}/audit`)
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(response.body.total).toBeGreaterThanOrEqual(1);
    expect(response.body.items[0].action).toBe('member.invited');
  });

  it('forbids a plain member from reading team audit (403)', async () => {
    const token = await tokenFor(fixture.memberUserId, [Role.User]);
    const response = await api()
      .get(`/api/v1/teams/${teamId}/audit`)
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(403);
    expect(response.body.messageKey).toBe('errors.auth.permissionDenied');
  });

  it('denies a suspended admin the audit read (403)', async () => {
    const token = await tokenFor(fixture.suspendedAdminId, [Role.Admin]);
    const response = await api()
      .get(`/api/v1/teams/${teamId}/audit`)
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(403);
    expect(response.body.messageKey).toBe('errors.auth.permissionDenied');
  });

  it('lets a scoped team admin read their team audit but denies another (403)', async () => {
    const token = await tokenFor(fixture.teamAdminUserId, [Role.User]);
    const allowed = await api()
      .get(`/api/v1/teams/${teamId}/audit`)
      .set('Authorization', `Bearer ${token}`);
    expect(allowed.status).toBe(200);

    const denied = await api()
      .get(`/api/v1/teams/${otherTeamId}/audit`)
      .set('Authorization', `Bearer ${token}`);
    expect(denied.status).toBe(403);
    expect(denied.body.messageKey).toBe('errors.auth.permissionDenied');
  });

  it('rejects a non-uuid team id on the audit route (400)', async () => {
    const token = await tokenFor(fixture.adminId, [Role.Admin]);
    const response = await api()
      .get('/api/v1/teams/not-a-uuid/audit')
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(400);
    expect(response.body.messageKey).toBe('errors.validation.invalidUuid');
  });

  // --- outbox admin (jobs.manage) ---------------------------------------------

  it('lets a system admin read outbox metrics', async () => {
    const token = await tokenFor(fixture.adminId, [Role.Admin]);
    const response = await api()
      .get('/api/v1/admin/outbox/metrics')
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(response.body.deadLettered).toBeGreaterThanOrEqual(1);
  });

  it('forbids a plain member from reading outbox metrics (403)', async () => {
    const token = await tokenFor(fixture.memberUserId, [Role.User]);
    const response = await api()
      .get('/api/v1/admin/outbox/metrics')
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(403);
    expect(response.body.messageKey).toBe('errors.auth.permissionDenied');
  });

  it('lists dead letters with stable failure codes and no error text', async () => {
    const token = await tokenFor(fixture.adminId, [Role.Admin]);
    const response = await api()
      .get('/api/v1/admin/outbox/dead-letters')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.total).toBeGreaterThanOrEqual(1);
    expect(response.body.limit).toBe(20);
    expect(response.body.offset).toBe(0);
    const entry = response.body.items.find(
      (item: { eventId: string }) => item.eventId === deadEventId,
    );
    expect(entry).toMatchObject({
      eventType: 'member.invited',
      attempts: 5,
      failureCode: 'unknown',
    });
    expect(typeof entry.failedAt).toBe('string');
    // Privacy is the shape: no payload and no raw error text on the wire.
    expect(entry).not.toHaveProperty('payload');
    expect(entry).not.toHaveProperty('lastError');
  });

  it('honours the bounded pagination window on the dead-letter listing', async () => {
    const token = await tokenFor(fixture.adminId, [Role.Admin]);
    const response = await api()
      .get('/api/v1/admin/outbox/dead-letters?limit=1&offset=999')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.items).toEqual([]);
    expect(response.body.limit).toBe(1);
    expect(response.body.total).toBeGreaterThanOrEqual(1);
  });

  it('forbids a plain member from listing dead letters (403)', async () => {
    const token = await tokenFor(fixture.memberUserId, [Role.User]);
    const response = await api()
      .get('/api/v1/admin/outbox/dead-letters')
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(403);
    expect(response.body.messageKey).toBe('errors.auth.permissionDenied');
  });

  it('rejects an unauthenticated dead-letter read (401)', async () => {
    const response = await api().get('/api/v1/admin/outbox/dead-letters');
    expect(response.status).toBe(401);
    expect(response.body.messageKey).toBe('errors.auth.tokenRequired');
  });

  it('lets a system admin replay a dead-lettered event', async () => {
    const token = await tokenFor(fixture.adminId, [Role.Admin]);
    const response = await api()
      .post(`/api/v1/admin/outbox/${deadEventId}/replay`)
      .set('Authorization', `Bearer ${token}`)
      .send();
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ eventId: deadEventId, requeued: true });
  });

  it('returns 404 replaying a missing outbox event', async () => {
    const token = await tokenFor(fixture.adminId, [Role.Admin]);
    const response = await api()
      .post(`/api/v1/admin/outbox/${randomUUID()}/replay`)
      .set('Authorization', `Bearer ${token}`)
      .send();
    expect(response.status).toBe(404);
    expect(response.body.messageKey).toBe(
      'errors.platform.outboxEventNotFound',
    );
  });

  it('forbids a plain member from replaying an event (403)', async () => {
    const token = await tokenFor(fixture.memberUserId, [Role.User]);
    const response = await api()
      .post(`/api/v1/admin/outbox/${deadEventId}/replay`)
      .set('Authorization', `Bearer ${token}`)
      .send();
    expect(response.status).toBe(403);
    expect(response.body.messageKey).toBe('errors.auth.permissionDenied');
  });

  it('clears a replayed event from the dead-letter listing', async () => {
    const token = await tokenFor(fixture.adminId, [Role.Admin]);
    // The earlier replay test requeued the seeded dead event.
    const response = await api()
      .get('/api/v1/admin/outbox/dead-letters')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(
      response.body.items.map((item: { eventId: string }) => item.eventId),
    ).not.toContain(deadEventId);
  });

  // --- jobs health (jobs.manage) ----------------------------------------------

  it('reports every registered job, honest degraded before any recorded run', async () => {
    const token = await tokenFor(fixture.adminId, [Role.Admin]);
    const response = await api()
      .get('/api/v1/admin/jobs/health')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.items).toEqual([
      {
        jobKey: 'invitations.expiry',
        status: 'degraded',
        lastRunAt: null,
        failureCount: 0,
      },
      {
        jobKey: 'outbox.dispatcher',
        status: 'degraded',
        lastRunAt: null,
        failureCount: 0,
      },
    ]);
  });

  it('derives job status from recorded heartbeats', async () => {
    await fixture.dataSource.query(
      `INSERT INTO "job_heartbeats"
         ("job_key", "last_run_at", "last_outcome", "failure_count")
       VALUES ('outbox.dispatcher', now(), 'succeeded', 0),
              ('invitations.expiry', now(), 'failed', 2)`,
    );
    const token = await tokenFor(fixture.adminId, [Role.Admin]);

    const response = await api()
      .get('/api/v1/admin/jobs/health')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    const byKey = new Map(
      (
        response.body.items as {
          jobKey: string;
          status: string;
          lastRunAt: string | null;
          failureCount: number;
        }[]
      ).map(item => [item.jobKey, item]),
    );
    expect(byKey.get('outbox.dispatcher')).toMatchObject({
      status: 'healthy',
      failureCount: 0,
    });
    expect(byKey.get('outbox.dispatcher')?.lastRunAt).not.toBeNull();
    expect(byKey.get('invitations.expiry')).toMatchObject({
      status: 'failed',
      failureCount: 2,
    });
  });

  it('forbids a plain member from reading job health (403)', async () => {
    const token = await tokenFor(fixture.memberUserId, [Role.User]);
    const response = await api()
      .get('/api/v1/admin/jobs/health')
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(403);
    expect(response.body.messageKey).toBe('errors.auth.permissionDenied');
  });

  it('rejects an unauthenticated job-health read (401)', async () => {
    const response = await api().get('/api/v1/admin/jobs/health');
    expect(response.status).toBe(401);
    expect(response.body.messageKey).toBe('errors.auth.tokenRequired');
  });
});
