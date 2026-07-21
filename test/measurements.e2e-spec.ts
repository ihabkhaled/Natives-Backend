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
import { PracticeRemindersCalendarSchema1722200000000 } from '../src/database/migrations/1722200000000-practice-reminders-calendar-schema';
import { AssessmentCatalogSchema1722300000000 } from '../src/database/migrations/1722300000000-assessment-catalog-schema';
import { PlayerAssessmentSchema1722400000000 } from '../src/database/migrations/1722400000000-player-assessment-schema';
import { DevelopmentSchema1722500000000 } from '../src/database/migrations/1722500000000-development-schema';
import { SeedHistorySchema1722600000000 } from '../src/database/migrations/1722600000000-seed-history-schema';
import { ScoringSchema1722700000000 } from '../src/database/migrations/1722700000000-scoring-schema';
import { MeasurementsSchema1722800000000 } from '../src/database/migrations/1722800000000-measurements-schema';
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
  PracticeRemindersCalendarSchema1722200000000,
  AssessmentCatalogSchema1722300000000,
  PlayerAssessmentSchema1722400000000,
  DevelopmentSchema1722500000000,
  SeedHistorySchema1722600000000,
  ScoringSchema1722700000000,
  MeasurementsSchema1722800000000,
  PlatformLifecycleSchema1723800000000,
];

interface Fixture {
  readonly dataSource: DataSource;
  readonly adminId: string;
  readonly coachId: string;
  readonly memberId: string;
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
      coachId: await seedUser(dataSource, Role.User),
      memberId: await seedUser(dataSource, Role.User),
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
  ? 'Measurements authorization matrix (e2e, PostgreSQL)'
  : `Measurements (e2e) (SKIPPED: test database unreachable at ${TEST_DB_HOST}:${TEST_DB_PORT})`;

describeIfDb(suiteTitle, () => {
  if (!seeded) {
    return;
  }
  const fixture: Fixture = seeded;
  let app: NestFastifyApplication;
  let teamId: string;
  let memberMembershipId: string;
  let protocolId: string;
  let sessionId: string;
  const otherTeamId = randomUUID();

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

  async function seedMembership(userId: string): Promise<string> {
    const id = randomUUID();
    await fixture.dataSource.query(
      `INSERT INTO "memberships" ("id", "team_id", "user_id", "status")
       VALUES ($1, $2, $3, 'active')`,
      [id, teamId, userId],
    );
    return id;
  }

  function protocolsBase(path: string): string {
    return `/api/v1/teams/${teamId}/measurement-protocols${path}`;
  }

  function sessionsBase(path: string): string {
    return `/api/v1/teams/${teamId}/measurement-sessions${path}`;
  }

  function protocolBody(): Record<string, unknown> {
    return {
      protocolKey: `sprint_${randomUUID().slice(0, 8)}`,
      name: '20 m sprint',
      discipline: 'speed',
      unit: 'seconds',
      direction: 'better_lower',
      resultPolicy: 'best',
    };
  }

  async function createSession(coachToken: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .post(sessionsBase(''))
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ title: 'Combine', scheduledAt: '2026-06-01T09:00:00.000Z' });
    return response.body.id;
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
    await assignRole(fixture.coachId, RbacRole.Coach);
    await assignRole(fixture.memberId, RbacRole.Member);
    memberMembershipId = await seedMembership(fixture.memberId);

    const coachToken = await tokenFor(fixture.coachId, [Role.User]);
    const protocol = await request(app.getHttpServer())
      .post(protocolsBase(''))
      .set('Authorization', `Bearer ${coachToken}`)
      .send(protocolBody());
    protocolId = protocol.body.id;
    sessionId = await createSession(coachToken);
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

  it('lets a coach create a protocol and schedule a session (201)', () => {
    expect(protocolId).toMatch(/[0-9a-f-]{36}/u);
    expect(sessionId).toMatch(/[0-9a-f-]{36}/u);
  });

  it('records attempts (best of valid, null excluded) and emits the outbox event (201)', async () => {
    const token = await tokenFor(fixture.coachId, [Role.User]);
    const response = await request(app.getHttpServer())
      .post(sessionsBase(`/${sessionId}/attempts`))
      .set('Authorization', `Bearer ${token}`)
      .send({
        membershipId: memberMembershipId,
        protocolId,
        attempts: [
          { value: 3.4, unit: 'seconds' },
          { value: 3.1, unit: 'seconds' },
          { value: null, unit: 'seconds' },
        ],
      });
    expect(response.status).toBe(201);
    expect(response.body.result.best).toBe(3.1);
    expect(response.body.result.selected).toBe(3.1);
    expect(response.body.result.consideredCount).toBe(2);
    expect(response.body.result.excludedCount).toBe(1);
    const events = await fixture.dataSource.query(
      `SELECT COUNT(*)::int AS "count" FROM "outbox_events"
        WHERE "event_type" = 'measurement.recorded.v1' AND "team_id" = $1`,
      [teamId],
    );
    expect(events[0].count).toBeGreaterThanOrEqual(1);
  });

  it('lets a coach read a player’s history (200, analytics.read.team)', async () => {
    const token = await tokenFor(fixture.coachId, [Role.User]);
    const response = await request(app.getHttpServer())
      .get(`/api/v1/teams/${teamId}/measurement-history/${memberMembershipId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(response.body.entries.length).toBeGreaterThanOrEqual(1);
    expect(response.body.entries[0].result.selected).toBe(3.1);
  });

  it('lets a member read only their own history (200, analytics.read.self)', async () => {
    const token = await tokenFor(fixture.memberId, [Role.User]);
    const response = await request(app.getHttpServer())
      .get(`/api/v1/teams/${teamId}/my-measurements`)
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(response.body.membershipId).toBe(memberMembershipId);
    expect(response.body.entries.length).toBeGreaterThanOrEqual(1);
  });

  it('forbids a member from recording measurements (403)', async () => {
    const token = await tokenFor(fixture.memberId, [Role.User]);
    const response = await request(app.getHttpServer())
      .post(sessionsBase(`/${sessionId}/attempts`))
      .set('Authorization', `Bearer ${token}`)
      .send({
        membershipId: memberMembershipId,
        protocolId,
        attempts: [{ value: 2.9, unit: 'seconds' }],
      });
    expect(response.status).toBe(403);
    expect(response.body.messageKey).toBe('errors.auth.permissionDenied');
  });

  it('forbids a member from listing the team’s sessions (403)', async () => {
    const token = await tokenFor(fixture.memberId, [Role.User]);
    const response = await request(app.getHttpServer())
      .get(sessionsBase(''))
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(403);
    expect(response.body.messageKey).toBe('errors.auth.permissionDenied');
  });

  it('denies a coach scoped to a different team (403)', async () => {
    const token = await tokenFor(fixture.coachId, [Role.User]);
    const response = await request(app.getHttpServer())
      .get(`/api/v1/teams/${otherTeamId}/measurement-sessions`)
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(403);
    expect(response.body.messageKey).toBe('errors.auth.permissionDenied');
  });

  it('rejects a cross-dimension attempt unit (400 unitIncompatible)', async () => {
    const token = await tokenFor(fixture.coachId, [Role.User]);
    const response = await request(app.getHttpServer())
      .post(sessionsBase(`/${sessionId}/attempts`))
      .set('Authorization', `Bearer ${token}`)
      .send({
        membershipId: memberMembershipId,
        protocolId,
        attempts: [{ value: 5, unit: 'meters' }],
      });
    expect(response.status).toBe(400);
    expect(response.body.messageKey).toBe(
      'errors.measurements.unitIncompatible',
    );
  });

  it('rejects an empty attempts array (400 validation.failed)', async () => {
    const token = await tokenFor(fixture.coachId, [Role.User]);
    const response = await request(app.getHttpServer())
      .post(sessionsBase(`/${sessionId}/attempts`))
      .set('Authorization', `Bearer ${token}`)
      .send({ membershipId: memberMembershipId, protocolId, attempts: [] });
    expect(response.status).toBe(400);
    expect(response.body.messageKey).toBe('errors.validation.failed');
  });

  it('rejects recording into a cancelled session (409 invalidTransition)', async () => {
    const token = await tokenFor(fixture.coachId, [Role.User]);
    const cancelledSessionId = await createSession(token);
    const created = await fixture.dataSource.query(
      `SELECT "record_version" FROM "measurement_sessions" WHERE "id" = $1`,
      [cancelledSessionId],
    );
    await request(app.getHttpServer())
      .post(sessionsBase(`/${cancelledSessionId}/transition`))
      .set('Authorization', `Bearer ${token}`)
      .send({
        transition: 'cancel',
        expectedRecordVersion: created[0].record_version,
      });
    const response = await request(app.getHttpServer())
      .post(sessionsBase(`/${cancelledSessionId}/attempts`))
      .set('Authorization', `Bearer ${token}`)
      .send({
        membershipId: memberMembershipId,
        protocolId,
        attempts: [{ value: 3.0, unit: 'seconds' }],
      });
    expect(response.status).toBe(409);
    expect(response.body.messageKey).toBe(
      'errors.measurements.invalidTransition',
    );
  });

  it('rejects the self read without a token (401 tokenRequired)', async () => {
    const response = await request(app.getHttpServer()).get(
      `/api/v1/teams/${teamId}/my-measurements`,
    );
    expect(response.status).toBe(401);
    expect(response.body.messageKey).toBe('errors.auth.tokenRequired');
  });
});
