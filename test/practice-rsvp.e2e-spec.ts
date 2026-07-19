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
import { PracticeRsvpSchema1721900000000 } from '../src/database/migrations/1721900000000-practice-rsvp-schema';

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
  PracticesSchema1721800000000,
  PracticeRsvpSchema1721900000000,
];

interface Fixture {
  readonly dataSource: DataSource;
  readonly adminId: string;
  readonly memberId: string;
  readonly member2Id: string;
  readonly outsiderId: string;
  readonly coachUserId: string;
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
      member2Id: await seedUser(dataSource, 'active', Role.User),
      outsiderId: await seedUser(dataSource, 'active', Role.User),
      coachUserId: await seedUser(dataSource, 'active', Role.User),
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
  ? 'Practice RSVP authorization matrix (e2e, PostgreSQL)'
  : `Practice RSVP (e2e) (SKIPPED: test database unreachable at ${TEST_DB_HOST}:${TEST_DB_PORT} — start docker-compose.test.yml)`;

function sessionBody(
  overrides: Record<string, unknown>,
): Record<string, unknown> {
  return {
    sessionType: 'practice',
    startsAt: '2026-09-15T15:00:00.000Z',
    endsAt: '2026-09-15T17:00:00.000Z',
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
  let memberMembershipId: string;
  let member2MembershipId: string;
  const otherTeamId = randomUUID();

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

  async function seedMembership(userId: string): Promise<string> {
    const id = randomUUID();
    await fixture.dataSource.query(
      `INSERT INTO "memberships" ("id", "team_id", "user_id", "status")
       VALUES ($1, $2, $3, 'active')`,
      [id, teamId, userId],
    );
    return id;
  }

  function base(): string {
    return `/api/v1/teams/${teamId}`;
  }

  async function createPublishedSession(
    token: string,
    overrides: Record<string, unknown>,
  ): Promise<{ id: string; version: number }> {
    const created = await request(app.getHttpServer())
      .post(`${base()}/practice-sessions`)
      .set('Authorization', `Bearer ${token}`)
      .send(sessionBody(overrides));
    const published = await request(app.getHttpServer())
      .post(`${base()}/practice-sessions/${created.body.id}/publish`)
      .set('Authorization', `Bearer ${token}`)
      .send({ expectedVersion: created.body.version });
    return { id: published.body.id, version: published.body.version };
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
    await assignTeamAdmin(fixture.coachUserId);
    memberMembershipId = await seedMembership(fixture.memberId);
    member2MembershipId = await seedMembership(fixture.member2Id);
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

  it('lets a member set and re-read their own availability', async () => {
    const admin = await tokenFor(fixture.adminId, [Role.Admin]);
    const session = await createPublishedSession(admin, {});
    const token = await tokenFor(fixture.memberId, [Role.User]);

    const set = await request(app.getHttpServer())
      .put(`${base()}/practice-sessions/${session.id}/rsvp`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'going', note: 'see you there' });
    expect(set.status).toBe(200);
    expect(set.body.status).toBe('going');
    expect(set.body.waitlisted).toBe(false);

    const read = await request(app.getHttpServer())
      .get(`${base()}/practice-sessions/${session.id}/rsvp`)
      .set('Authorization', `Bearer ${token}`);
    expect(read.status).toBe(200);
    expect(read.body.status).toBe('going');
  });

  it('returns an explicit no_response before a member has answered', async () => {
    const admin = await tokenFor(fixture.adminId, [Role.Admin]);
    const session = await createPublishedSession(admin, {});
    const token = await tokenFor(fixture.memberId, [Role.User]);
    const read = await request(app.getHttpServer())
      .get(`${base()}/practice-sessions/${session.id}/rsvp`)
      .set('Authorization', `Bearer ${token}`);
    expect(read.status).toBe(200);
    expect(read.body.status).toBe('no_response');
    expect(read.body.version).toBeNull();
  });

  it('forbids self RSVP for a user with no membership in the team (403)', async () => {
    const admin = await tokenFor(fixture.adminId, [Role.Admin]);
    const session = await createPublishedSession(admin, {});
    const token = await tokenFor(fixture.outsiderId, [Role.User]);
    const set = await request(app.getHttpServer())
      .put(`${base()}/practice-sessions/${session.id}/rsvp`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'going' });
    expect(set.status).toBe(403);
    expect(set.body.messageKey).toBe('errors.practices.rsvpNotMember');
  });

  it('rejects self RSVP after the deadline but lets a coach override past it', async () => {
    const admin = await tokenFor(fixture.adminId, [Role.Admin]);
    const session = await createPublishedSession(admin, {
      rsvpCutoffAt: '2000-01-01T00:00:00.000Z',
    });
    const memberToken = await tokenFor(fixture.memberId, [Role.User]);
    const late = await request(app.getHttpServer())
      .put(`${base()}/practice-sessions/${session.id}/rsvp`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ status: 'going' });
    expect(late.status).toBe(409);
    expect(late.body.messageKey).toBe('errors.practices.rsvpDeadlinePassed');

    const coach = await tokenFor(fixture.coachUserId, [Role.User]);
    const override = await request(app.getHttpServer())
      .put(
        `${base()}/practice-sessions/${session.id}/rsvps/${memberMembershipId}`,
      )
      .set('Authorization', `Bearer ${coach}`)
      .send({ status: 'not_going', reason: 'injured' });
    expect(override.status).toBe(200);
    expect(override.body.status).toBe('not_going');
  });

  it('forbids a plain member from overriding another member (403)', async () => {
    const admin = await tokenFor(fixture.adminId, [Role.Admin]);
    const session = await createPublishedSession(admin, {});
    const token = await tokenFor(fixture.memberId, [Role.User]);
    const override = await request(app.getHttpServer())
      .put(
        `${base()}/practice-sessions/${session.id}/rsvps/${member2MembershipId}`,
      )
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'going', reason: 'forced' });
    expect(override.status).toBe(403);
    expect(override.body.messageKey).toBe('errors.auth.permissionDenied');
  });

  it('denies a team-scoped coach acting on another team (403)', async () => {
    const admin = await tokenFor(fixture.adminId, [Role.Admin]);
    const session = await createPublishedSession(admin, {});
    const coach = await tokenFor(fixture.coachUserId, [Role.User]);
    const denied = await request(app.getHttpServer())
      .put(
        `/api/v1/teams/${otherTeamId}/practice-sessions/${session.id}/rsvps/${memberMembershipId}`,
      )
      .set('Authorization', `Bearer ${coach}`)
      .send({ status: 'going', reason: 'x' });
    expect(denied.status).toBe(403);
    expect(denied.body.messageKey).toBe('errors.auth.permissionDenied');
  });

  it('requires an override reason (400)', async () => {
    const admin = await tokenFor(fixture.adminId, [Role.Admin]);
    const session = await createPublishedSession(admin, {});
    const coach = await tokenFor(fixture.coachUserId, [Role.User]);
    const override = await request(app.getHttpServer())
      .put(
        `${base()}/practice-sessions/${session.id}/rsvps/${memberMembershipId}`,
      )
      .set('Authorization', `Bearer ${coach}`)
      .send({ status: 'going' });
    expect(override.status).toBe(400);
    expect(override.body.messageKey).toBe('errors.validation.failed');
  });

  it('overrides a membership outside the team scope as not-found (404)', async () => {
    const admin = await tokenFor(fixture.adminId, [Role.Admin]);
    const session = await createPublishedSession(admin, {});
    const override = await request(app.getHttpServer())
      .put(`${base()}/practice-sessions/${session.id}/rsvps/${randomUUID()}`)
      .set('Authorization', `Bearer ${admin}`)
      .send({ status: 'going', reason: 'x' });
    expect(override.status).toBe(404);
    expect(override.body.messageKey).toBe(
      'errors.practices.rsvpMembershipNotFound',
    );
  });

  it('enforces capacity by waitlisting the overflow and reports it in the summary', async () => {
    const admin = await tokenFor(fixture.adminId, [Role.Admin]);
    const session = await createPublishedSession(admin, { capacity: 1 });
    const first = await tokenFor(fixture.memberId, [Role.User]);
    const second = await tokenFor(fixture.member2Id, [Role.User]);

    const a = await request(app.getHttpServer())
      .put(`${base()}/practice-sessions/${session.id}/rsvp`)
      .set('Authorization', `Bearer ${first}`)
      .send({ status: 'going' });
    expect(a.body.waitlisted).toBe(false);

    const b = await request(app.getHttpServer())
      .put(`${base()}/practice-sessions/${session.id}/rsvp`)
      .set('Authorization', `Bearer ${second}`)
      .send({ status: 'going' });
    expect(b.body.waitlisted).toBe(true);

    const summary = await request(app.getHttpServer())
      .get(`${base()}/practice-sessions/${session.id}/rsvps/summary`)
      .set('Authorization', `Bearer ${first}`);
    expect(summary.status).toBe(200);
    expect(summary.body.going).toBe(1);
    expect(summary.body.waitlisted).toBe(1);
    expect(summary.body.spotsRemaining).toBe(0);
  });

  it('promotes the waitlisted member when the confirmed member withdraws', async () => {
    const admin = await tokenFor(fixture.adminId, [Role.Admin]);
    const session = await createPublishedSession(admin, { capacity: 1 });
    const first = await tokenFor(fixture.memberId, [Role.User]);
    const second = await tokenFor(fixture.member2Id, [Role.User]);

    await request(app.getHttpServer())
      .put(`${base()}/practice-sessions/${session.id}/rsvp`)
      .set('Authorization', `Bearer ${first}`)
      .send({ status: 'going' });
    await request(app.getHttpServer())
      .put(`${base()}/practice-sessions/${session.id}/rsvp`)
      .set('Authorization', `Bearer ${second}`)
      .send({ status: 'going' });

    await request(app.getHttpServer())
      .put(`${base()}/practice-sessions/${session.id}/rsvp`)
      .set('Authorization', `Bearer ${first}`)
      .send({ status: 'not_going' });

    const summary = await request(app.getHttpServer())
      .get(`${base()}/practice-sessions/${session.id}/rsvps/summary`)
      .set('Authorization', `Bearer ${admin}`);
    expect(summary.body.going).toBe(1);
    expect(summary.body.waitlisted).toBe(0);
    expect(summary.body.notGoing).toBe(1);
  });

  it('reports a version conflict on a stale conditional update (409)', async () => {
    const admin = await tokenFor(fixture.adminId, [Role.Admin]);
    const session = await createPublishedSession(admin, {});
    const token = await tokenFor(fixture.memberId, [Role.User]);
    await request(app.getHttpServer())
      .put(`${base()}/practice-sessions/${session.id}/rsvp`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'going' });
    const stale = await request(app.getHttpServer())
      .put(`${base()}/practice-sessions/${session.id}/rsvp`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'maybe', expectedVersion: 999 });
    expect(stale.status).toBe(409);
    expect(stale.body.messageKey).toBe('errors.practices.versionConflict');
  });

  it('keeps RSVP history and closes new responses after cancellation', async () => {
    const admin = await tokenFor(fixture.adminId, [Role.Admin]);
    const session = await createPublishedSession(admin, {});
    const token = await tokenFor(fixture.memberId, [Role.User]);
    await request(app.getHttpServer())
      .put(`${base()}/practice-sessions/${session.id}/rsvp`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'going' });

    const cancelled = await request(app.getHttpServer())
      .post(`${base()}/practice-sessions/${session.id}/cancel`)
      .set('Authorization', `Bearer ${admin}`)
      .send({ reason: 'weather', expectedVersion: session.version });
    expect(cancelled.status).toBe(201);

    const summary = await request(app.getHttpServer())
      .get(`${base()}/practice-sessions/${session.id}/rsvps/summary`)
      .set('Authorization', `Bearer ${admin}`);
    expect(summary.body.going).toBe(1);

    const late = await request(app.getHttpServer())
      .put(`${base()}/practice-sessions/${session.id}/rsvp`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'maybe' });
    expect(late.status).toBe(409);
    expect(late.body.messageKey).toBe('errors.practices.rsvpClosed');
  });

  it('returns 404 for a session in the wrong team scope', async () => {
    const token = await tokenFor(fixture.memberId, [Role.User]);
    const response = await request(app.getHttpServer())
      .put(`${base()}/practice-sessions/${randomUUID()}/rsvp`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'going' });
    expect(response.status).toBe(404);
    expect(response.body.messageKey).toBe('errors.practices.sessionNotFound');
  });

  it('rejects a malformed session id (400 invalid uuid)', async () => {
    const token = await tokenFor(fixture.memberId, [Role.User]);
    const response = await request(app.getHttpServer())
      .get(`${base()}/practice-sessions/not-a-uuid/rsvp`)
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(400);
    expect(response.body.messageKey).toBe('errors.validation.invalidUuid');
  });

  it('requires authentication (401)', async () => {
    const response = await request(app.getHttpServer())
      .get(`${base()}/practice-sessions/${randomUUID()}/rsvps/summary`)
      .send();
    expect(response.status).toBe(401);
  });
});
