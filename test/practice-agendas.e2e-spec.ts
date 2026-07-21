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
import { AttendanceSchema1722000000000 } from '../src/database/migrations/1722000000000-attendance-schema';
import { PracticeAgendasSchema1722100000000 } from '../src/database/migrations/1722100000000-practice-agendas-schema';
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

const MIGRATIONS = [
  BaselineSchema1721200000000,
  IdentitySchema1721300000000,
  RbacSchema1721400000000,
  TeamsSchema1721500000000,
  MembersSchema1721600000000,
  PlatformSchema1721700000000,
  PracticesSchema1721800000000,
  PracticeRsvpSchema1721900000000,
  AttendanceSchema1722000000000,
  PracticeAgendasSchema1722100000000,
  PlatformLifecycleSchema1723800000000,
];

interface Fixture {
  readonly dataSource: DataSource;
  readonly adminId: string;
  readonly memberId: string;
  readonly coachUserId: string;
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
      memberId: await seedUser(dataSource, Role.User),
      coachUserId: await seedUser(dataSource, Role.User),
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
  ? 'Practice agendas authorization matrix (e2e, PostgreSQL)'
  : `Practice agendas (e2e) (SKIPPED: test database unreachable at ${TEST_DB_HOST}:${TEST_DB_PORT})`;

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

  function base(): string {
    return `/api/v1/teams/${teamId}`;
  }

  async function createSession(token: string): Promise<string> {
    const created = await request(app.getHttpServer())
      .post(`${base()}/practice-sessions`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        sessionType: 'practice',
        startsAt: '2026-09-15T15:00:00.000Z',
        endsAt: '2026-09-15T17:00:00.000Z',
      });
    return created.body.id;
  }

  async function createAgenda(token: string, sessionId: string): Promise<void> {
    await request(app.getHttpServer())
      .post(`${base()}/practice-sessions/${sessionId}/agenda`)
      .set('Authorization', `Bearer ${token}`)
      .send({ theme: 'defense' });
  }

  function addBlock(
    token: string,
    sessionId: string,
    body: Record<string, unknown>,
  ): request.Test {
    return request(app.getHttpServer())
      .post(`${base()}/practice-sessions/${sessionId}/agenda/blocks`)
      .set('Authorization', `Bearer ${token}`)
      .send(body);
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

  it('lets a coach author a drill but forbids a plain member (403)', async () => {
    const coach = await tokenFor(fixture.coachUserId, [Role.User]);
    const member = await tokenFor(fixture.memberId, [Role.User]);

    const created = await request(app.getHttpServer())
      .post(`${base()}/drills`)
      .set('Authorization', `Bearer ${coach}`)
      .send({
        name: `Give and go ${randomUUID().slice(0, 6)}`,
        category: 'offense',
      });
    expect(created.status).toBe(201);
    expect(created.body.status).toBe('active');

    const forbidden = await request(app.getHttpServer())
      .post(`${base()}/drills`)
      .set('Authorization', `Bearer ${member}`)
      .send({ name: 'X', category: 'offense' });
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.messageKey).toBe('errors.auth.permissionDenied');

    // a member may still read the catalog (practice.read)
    const list = await request(app.getHttpServer())
      .get(`${base()}/drills`)
      .set('Authorization', `Bearer ${member}`);
    expect(list.status).toBe(200);
    expect(list.body.total).toBeGreaterThanOrEqual(1);
  });

  it('keeps coach notes private and locks structure after publish', async () => {
    const coach = await tokenFor(fixture.coachUserId, [Role.User]);
    const member = await tokenFor(fixture.memberId, [Role.User]);
    const sessionId = await createSession(coach);
    await createAgenda(coach, sessionId);

    const block = await addBlock(coach, sessionId, {
      title: 'Warm up',
      blockType: 'warmup',
      coachNotes: 'watch the ACL',
    });
    expect(block.status).toBe(201);
    expect(block.body.coachNotes).toBe('watch the ACL');

    const broad = await request(app.getHttpServer())
      .get(`${base()}/practice-sessions/${sessionId}/agenda`)
      .set('Authorization', `Bearer ${member}`);
    expect(broad.status).toBe(200);
    expect(broad.body.blocks[0].coachNotes).toBeNull();

    const plan = await request(app.getHttpServer())
      .get(`${base()}/practice-sessions/${sessionId}/agenda/plan`)
      .set('Authorization', `Bearer ${coach}`);
    expect(plan.body.blocks[0].coachNotes).toBe('watch the ACL');

    const memberPlan = await request(app.getHttpServer())
      .get(`${base()}/practice-sessions/${sessionId}/agenda/plan`)
      .set('Authorization', `Bearer ${member}`);
    expect(memberPlan.status).toBe(403);

    const published = await request(app.getHttpServer())
      .post(`${base()}/practice-sessions/${sessionId}/agenda/publish`)
      .set('Authorization', `Bearer ${coach}`)
      .send({});
    expect(published.status).toBe(200);
    expect(published.body.status).toBe('published');

    const afterPublish = await addBlock(coach, sessionId, {
      title: 'Late add',
    });
    expect(afterPublish.status).toBe(409);
    expect(afterPublish.body.messageKey).toBe('errors.practices.agendaLocked');
  });

  it('reorders blocks with optimistic concurrency and rejects a stale reorder', async () => {
    const coach = await tokenFor(fixture.coachUserId, [Role.User]);
    const sessionId = await createSession(coach);
    await createAgenda(coach, sessionId);
    const first = (await addBlock(coach, sessionId, { title: 'One' })).body.id;
    const second = (await addBlock(coach, sessionId, { title: 'Two' })).body.id;

    const view = await request(app.getHttpServer())
      .get(`${base()}/practice-sessions/${sessionId}/agenda`)
      .set('Authorization', `Bearer ${coach}`);
    const version = view.body.version;

    const reordered = await request(app.getHttpServer())
      .post(`${base()}/practice-sessions/${sessionId}/agenda/blocks/reorder`)
      .set('Authorization', `Bearer ${coach}`)
      .send({ blockIds: [second, first], expectedVersion: version });
    expect(reordered.status).toBe(200);

    const stale = await request(app.getHttpServer())
      .post(`${base()}/practice-sessions/${sessionId}/agenda/blocks/reorder`)
      .set('Authorization', `Bearer ${coach}`)
      .send({ blockIds: [first, second], expectedVersion: version });
    expect(stale.status).toBe(409);
    expect(stale.body.messageKey).toBe('errors.practices.versionConflict');

    const invalid = await request(app.getHttpServer())
      .post(`${base()}/practice-sessions/${sessionId}/agenda/blocks/reorder`)
      .set('Authorization', `Bearer ${coach}`)
      .send({ blockIds: [first, randomUUID()] });
    expect(invalid.status).toBe(400);
    expect(invalid.body.messageKey).toBe('errors.practices.invalidReorder');
  });

  it('copies a plan independently of the source', async () => {
    const coach = await tokenFor(fixture.coachUserId, [Role.User]);
    const sourceSession = await createSession(coach);
    await createAgenda(coach, sourceSession);
    await addBlock(coach, sourceSession, { title: 'Original' });

    const targetSession = await createSession(coach);
    const copied = await request(app.getHttpServer())
      .post(`${base()}/practice-sessions/${targetSession}/agenda/copy`)
      .set('Authorization', `Bearer ${coach}`)
      .send({ sourceSessionId: sourceSession });
    expect(copied.status).toBe(200);

    await addBlock(coach, targetSession, { title: 'Added to copy' });

    const source = await request(app.getHttpServer())
      .get(`${base()}/practice-sessions/${sourceSession}/agenda`)
      .set('Authorization', `Bearer ${coach}`);
    const target = await request(app.getHttpServer())
      .get(`${base()}/practice-sessions/${targetSession}/agenda`)
      .set('Authorization', `Bearer ${coach}`);
    expect(source.body.blocks).toHaveLength(1);
    expect(target.body.blocks).toHaveLength(2);
    expect(source.body.blocks[0].title).toBe('Original');
  });

  it('keeps a drill reference stable after the drill is archived', async () => {
    const coach = await tokenFor(fixture.coachUserId, [Role.User]);
    const drill = await request(app.getHttpServer())
      .post(`${base()}/drills`)
      .set('Authorization', `Bearer ${coach}`)
      .send({
        name: `Archived drill ${randomUUID().slice(0, 6)}`,
        category: 'defense',
      });
    const drillId = drill.body.id;

    const sessionId = await createSession(coach);
    await createAgenda(coach, sessionId);
    await addBlock(coach, sessionId, { title: 'Uses drill', drillId });

    const archived = await request(app.getHttpServer())
      .post(`${base()}/drills/${drillId}/archive`)
      .set('Authorization', `Bearer ${coach}`)
      .send();
    expect(archived.status).toBe(200);
    expect(archived.body.status).toBe('archived');

    const agenda = await request(app.getHttpServer())
      .get(`${base()}/practice-sessions/${sessionId}/agenda`)
      .set('Authorization', `Bearer ${coach}`);
    expect(agenda.body.blocks[0].drillId).toBe(drillId);
  });

  it('denies a team-scoped coach acting on another team (403)', async () => {
    const coach = await tokenFor(fixture.coachUserId, [Role.User]);
    const response = await request(app.getHttpServer())
      .post(`/api/v1/teams/${otherTeamId}/drills`)
      .set('Authorization', `Bearer ${coach}`)
      .send({ name: 'Cross team', category: 'offense' });
    expect(response.status).toBe(403);
    expect(response.body.messageKey).toBe('errors.auth.permissionDenied');
  });

  it('returns 404 for an agenda in the wrong team scope', async () => {
    const coach = await tokenFor(fixture.coachUserId, [Role.User]);
    const response = await request(app.getHttpServer())
      .post(`${base()}/practice-sessions/${randomUUID()}/agenda/blocks`)
      .set('Authorization', `Bearer ${coach}`)
      .send({ title: 'Ghost' });
    expect(response.status).toBe(404);
    expect(response.body.messageKey).toBe('errors.practices.sessionNotFound');
  });

  it('rejects a malformed drill id (400 invalid uuid)', async () => {
    const coach = await tokenFor(fixture.coachUserId, [Role.User]);
    const response = await request(app.getHttpServer())
      .get(`${base()}/drills/not-a-uuid`)
      .set('Authorization', `Bearer ${coach}`);
    expect(response.status).toBe(400);
    expect(response.body.messageKey).toBe('errors.validation.invalidUuid');
  });

  it('requires authentication (401)', async () => {
    const response = await request(app.getHttpServer())
      .get(`${base()}/drills`)
      .send();
    expect(response.status).toBe(401);
  });
});
