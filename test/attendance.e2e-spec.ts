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
  PracticeRsvpSchema1721900000000,
  AttendanceSchema1722000000000,
];

interface Fixture {
  readonly dataSource: DataSource;
  readonly adminId: string;
  readonly memberId: string;
  readonly outsiderId: string;
  readonly coachUserId: string;
  readonly suspendedId: string;
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
      outsiderId: await seedUser(dataSource, 'active', Role.User),
      coachUserId: await seedUser(dataSource, 'active', Role.User),
      suspendedId: await seedUser(dataSource, 'active', Role.User),
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
  ? 'Attendance authorization matrix (e2e, PostgreSQL)'
  : `Attendance (e2e) (SKIPPED: test database unreachable at ${TEST_DB_HOST}:${TEST_DB_PORT} — start docker-compose.test.yml)`;

describeIfDb(suiteTitle, () => {
  if (!seeded) {
    return;
  }
  const fixture: Fixture = seeded;
  let app: NestFastifyApplication;
  let teamId: string;
  let memberMembershipId: string;
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

  async function seedMembership(
    userId: string,
    status: string,
  ): Promise<string> {
    const id = randomUUID();
    await fixture.dataSource.query(
      `INSERT INTO "memberships" ("id", "team_id", "user_id", "status")
       VALUES ($1, $2, $3, $4)`,
      [id, teamId, userId, status],
    );
    return id;
  }

  function base(): string {
    return `/api/v1/teams/${teamId}`;
  }

  async function createPublishedSession(
    token: string,
  ): Promise<{ id: string; version: number }> {
    const created = await request(app.getHttpServer())
      .post(`${base()}/practice-sessions`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        sessionType: 'practice',
        startsAt: '2026-09-15T15:00:00.000Z',
        endsAt: '2026-09-15T17:00:00.000Z',
      });
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
    memberMembershipId = await seedMembership(fixture.memberId, 'active');
    await seedMembership(fixture.suspendedId, 'suspended');
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

  it('lets a coach record a member and lists the roster', async () => {
    const admin = await tokenFor(fixture.adminId, [Role.Admin]);
    const coach = await tokenFor(fixture.coachUserId, [Role.User]);
    const session = await createPublishedSession(admin);

    const recorded = await request(app.getHttpServer())
      .put(
        `${base()}/practice-sessions/${session.id}/attendance/${memberMembershipId}`,
      )
      .set('Authorization', `Bearer ${coach}`)
      .send({ status: 'present_late', latenessMinutes: 8 });
    expect(recorded.status).toBe(200);
    expect(recorded.body.status).toBe('present_late');
    expect(recorded.body.latenessMinutes).toBe(8);

    const roster = await request(app.getHttpServer())
      .get(`${base()}/practice-sessions/${session.id}/attendance`)
      .set('Authorization', `Bearer ${coach}`);
    expect(roster.status).toBe(200);
    expect(roster.body.state).toBe('open');
    expect(roster.body.total).toBeGreaterThanOrEqual(1);
  });

  it('forbids a plain member from recording attendance (403)', async () => {
    const admin = await tokenFor(fixture.adminId, [Role.Admin]);
    const member = await tokenFor(fixture.memberId, [Role.User]);
    const session = await createPublishedSession(admin);
    const response = await request(app.getHttpServer())
      .put(
        `${base()}/practice-sessions/${session.id}/attendance/${memberMembershipId}`,
      )
      .set('Authorization', `Bearer ${member}`)
      .send({ status: 'present_on_time' });
    expect(response.status).toBe(403);
    expect(response.body.messageKey).toBe('errors.auth.permissionDenied');
  });

  it('denies a team-scoped coach acting on another team (403)', async () => {
    const admin = await tokenFor(fixture.adminId, [Role.Admin]);
    const coach = await tokenFor(fixture.coachUserId, [Role.User]);
    const session = await createPublishedSession(admin);
    const response = await request(app.getHttpServer())
      .put(
        `/api/v1/teams/${otherTeamId}/practice-sessions/${session.id}/attendance/${memberMembershipId}`,
      )
      .set('Authorization', `Bearer ${coach}`)
      .send({ status: 'present_on_time' });
    expect(response.status).toBe(403);
    expect(response.body.messageKey).toBe('errors.auth.permissionDenied');
  });

  it('lets an active member self check-in but denies a suspended member (403)', async () => {
    const admin = await tokenFor(fixture.adminId, [Role.Admin]);
    const session = await createPublishedSession(admin);

    const member = await tokenFor(fixture.memberId, [Role.User]);
    const checkIn = await request(app.getHttpServer())
      .post(`${base()}/practice-sessions/${session.id}/attendance/check-in`)
      .set('Authorization', `Bearer ${member}`)
      .send({});
    expect(checkIn.status).toBe(200);
    expect(['present_on_time', 'present_late']).toContain(checkIn.body.status);

    const suspended = await tokenFor(fixture.suspendedId, [Role.User]);
    const denied = await request(app.getHttpServer())
      .post(`${base()}/practice-sessions/${session.id}/attendance/check-in`)
      .set('Authorization', `Bearer ${suspended}`)
      .send({});
    expect(denied.status).toBe(403);
    expect(denied.body.messageKey).toBe('errors.practices.attendanceNotMember');
  });

  it('finalizes then corrects, locking the sheet and rejecting re-finalize', async () => {
    const admin = await tokenFor(fixture.adminId, [Role.Admin]);
    const coach = await tokenFor(fixture.coachUserId, [Role.User]);
    const session = await createPublishedSession(admin);

    await request(app.getHttpServer())
      .put(
        `${base()}/practice-sessions/${session.id}/attendance/${memberMembershipId}`,
      )
      .set('Authorization', `Bearer ${coach}`)
      .send({ status: 'present_on_time' });

    const roster = await request(app.getHttpServer())
      .get(`${base()}/practice-sessions/${session.id}/attendance`)
      .set('Authorization', `Bearer ${coach}`);
    const finalized = await request(app.getHttpServer())
      .post(`${base()}/practice-sessions/${session.id}/attendance/finalize`)
      .set('Authorization', `Bearer ${coach}`)
      .send({ expectedVersion: roster.body.version });
    expect(finalized.status).toBe(200);
    expect(finalized.body.state).toBe('finalized');

    const locked = await request(app.getHttpServer())
      .put(
        `${base()}/practice-sessions/${session.id}/attendance/${memberMembershipId}`,
      )
      .set('Authorization', `Bearer ${coach}`)
      .send({ status: 'absent' });
    expect(locked.status).toBe(409);
    expect(locked.body.messageKey).toBe('errors.practices.attendanceLocked');

    const reFinalize = await request(app.getHttpServer())
      .post(`${base()}/practice-sessions/${session.id}/attendance/finalize`)
      .set('Authorization', `Bearer ${coach}`)
      .send({ expectedVersion: finalized.body.version });
    expect(reFinalize.status).toBe(409);
    expect(reFinalize.body.messageKey).toBe(
      'errors.practices.invalidAttendanceTransition',
    );

    const corrected = await request(app.getHttpServer())
      .put(
        `${base()}/practice-sessions/${session.id}/attendance/${memberMembershipId}/correction`,
      )
      .set('Authorization', `Bearer ${coach}`)
      .send({ status: 'excused', reason: 'doctor note' });
    expect(corrected.status).toBe(200);
    expect(corrected.body.status).toBe('excused');

    const after = await request(app.getHttpServer())
      .get(`${base()}/practice-sessions/${session.id}/attendance`)
      .set('Authorization', `Bearer ${coach}`);
    expect(after.body.state).toBe('corrected');
  });

  it('forbids a plain member from correcting attendance (403)', async () => {
    const admin = await tokenFor(fixture.adminId, [Role.Admin]);
    const member = await tokenFor(fixture.memberId, [Role.User]);
    const session = await createPublishedSession(admin);
    const response = await request(app.getHttpServer())
      .put(
        `${base()}/practice-sessions/${session.id}/attendance/${memberMembershipId}/correction`,
      )
      .set('Authorization', `Bearer ${member}`)
      .send({ status: 'excused', reason: 'x' });
    expect(response.status).toBe(403);
    expect(response.body.messageKey).toBe('errors.auth.permissionDenied');
  });

  it('projects reproducible participation inputs citing the rule version', async () => {
    const admin = await tokenFor(fixture.adminId, [Role.Admin]);
    const coach = await tokenFor(fixture.coachUserId, [Role.User]);
    const session = await createPublishedSession(admin);
    const soloUser = await seedUser(fixture.dataSource, 'active', Role.User);
    const soloMembership = await seedMembership(soloUser, 'active');

    await request(app.getHttpServer())
      .put(
        `${base()}/practice-sessions/${session.id}/attendance/${soloMembership}`,
      )
      .set('Authorization', `Bearer ${coach}`)
      .send({ status: 'present_on_time' });
    const roster = await request(app.getHttpServer())
      .get(`${base()}/practice-sessions/${session.id}/attendance`)
      .set('Authorization', `Bearer ${coach}`);
    await request(app.getHttpServer())
      .post(`${base()}/practice-sessions/${session.id}/attendance/finalize`)
      .set('Authorization', `Bearer ${coach}`)
      .send({ expectedVersion: roster.body.version });

    const participation = await request(app.getHttpServer())
      .get(`${base()}/attendance/participation/${soloMembership}`)
      .set('Authorization', `Bearer ${coach}`);
    expect(participation.status).toBe(200);
    expect(participation.body.ruleVersion).toBe('legacy-candidate-v1');
    expect(participation.body.onTime).toBe(1);
    expect(participation.body.attendanceRate).toBe(1);
    expect(participation.body.attendanceRatePercent).toBe(100);
  });

  it('returns 404 for a session in the wrong team scope', async () => {
    const coach = await tokenFor(fixture.coachUserId, [Role.User]);
    const response = await request(app.getHttpServer())
      .put(
        `${base()}/practice-sessions/${randomUUID()}/attendance/${memberMembershipId}`,
      )
      .set('Authorization', `Bearer ${coach}`)
      .send({ status: 'present_on_time' });
    expect(response.status).toBe(404);
    expect(response.body.messageKey).toBe('errors.practices.sessionNotFound');
  });

  it('rejects a malformed session id (400 invalid uuid)', async () => {
    const member = await tokenFor(fixture.memberId, [Role.User]);
    const response = await request(app.getHttpServer())
      .get(`${base()}/practice-sessions/not-a-uuid/attendance/me`)
      .set('Authorization', `Bearer ${member}`);
    expect(response.status).toBe(400);
    expect(response.body.messageKey).toBe('errors.validation.invalidUuid');
  });

  it('requires authentication (401)', async () => {
    const response = await request(app.getHttpServer())
      .get(`${base()}/practice-sessions/${randomUUID()}/attendance`)
      .send();
    expect(response.status).toBe(401);
  });
});
