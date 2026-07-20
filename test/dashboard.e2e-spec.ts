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
import { ActivitiesSchema1722900000000 } from '../src/database/migrations/1722900000000-activities-schema';
import { ActivityReviewSchema1723000000000 } from '../src/database/migrations/1723000000000-activity-review-schema';
import { PointsSchema1723100000000 } from '../src/database/migrations/1723100000000-points-schema';
import { LeaderboardIndexes1723200000000 } from '../src/database/migrations/1723200000000-leaderboard-indexes';

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
  poolMax: 6,
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
  ActivitiesSchema1722900000000,
  ActivityReviewSchema1723000000000,
  PointsSchema1723100000000,
  LeaderboardIndexes1723200000000,
];

interface Fixture {
  readonly dataSource: DataSource;
  readonly adminId: string;
  readonly memberUserId: string;
  readonly coachUserId: string;
  readonly outsiderUserId: string;
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
      outsiderUserId: await seedUser(dataSource, Role.User),
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
  ? 'Dashboard summary authorization matrix (e2e, PostgreSQL)'
  : `Dashboard (e2e) (SKIPPED: test database unreachable at ${TEST_DB_HOST}:${TEST_DB_PORT} — start docker-compose.test.yml)`;

describeIfDb(suiteTitle, () => {
  if (!seeded) {
    return;
  }
  const fixture: Fixture = seeded;
  let app: NestFastifyApplication;
  let teamId: string;
  let otherTeamId: string;
  const summaryPath = '/api/v1/dashboard/summary';

  function api() {
    return request(app.getHttpServer());
  }

  async function tokenFor(userId: string, roles: Role[]): Promise<string> {
    const tokenPort = app.get<AuthTokenPort>(AUTH_TOKEN_PORT);
    return tokenPort.sign({ userId, email: 'e@example.test', roles });
  }

  async function createTeam(adminToken: string): Promise<string> {
    const created = await api()
      .post('/api/v1/teams')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ slug: `natives-${randomUUID().slice(0, 8)}`, name: 'Natives' });
    return created.body.id;
  }

  async function activateMember(
    adminToken: string,
    team: string,
    userId: string,
  ): Promise<string> {
    const invited = await api()
      .post(`/api/v1/teams/${team}/members/invite`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        userId,
        profile: { fullName: 'Ahmed Hassan', email: 'ahmed@example.test' },
      });
    await api()
      .post(`/api/v1/teams/${team}/members/${invited.body.id}/activate`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    return invited.body.id;
  }

  async function assignRole(
    userId: string,
    roleKey: RbacRole,
    team: string,
  ): Promise<void> {
    const role = await fixture.dataSource.query(
      `SELECT "id" FROM "roles" WHERE "key" = $1`,
      [roleKey],
    );
    await fixture.dataSource.query(
      `INSERT INTO "user_role_assignments" ("id", "user_id", "role_id", "team_id")
       VALUES ($1, $2, $3, $4)`,
      [randomUUID(), userId, role[0].id, team],
    );
    await fixture.dataSource.query(
      `UPDATE "rbac_policy_version" SET "version" = "version" + 1 WHERE "singleton" = true`,
    );
  }

  function widgetKinds(body: {
    widgets: readonly { kind: string }[];
  }): readonly string[] {
    return body.widgets.map(widget => widget.kind);
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
    teamId = await createTeam(adminToken);
    otherTeamId = await createTeam(adminToken);

    await activateMember(adminToken, teamId, fixture.memberUserId);
    await activateMember(adminToken, teamId, fixture.coachUserId);
    await activateMember(adminToken, teamId, fixture.adminId);
    await activateMember(adminToken, otherTeamId, fixture.outsiderUserId);

    await assignRole(fixture.memberUserId, RbacRole.Member, teamId);
    await assignRole(fixture.coachUserId, RbacRole.Coach, teamId);
    await assignRole(fixture.outsiderUserId, RbacRole.Member, otherTeamId);
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

  it('rejects an unauthenticated request (401)', async () => {
    const response = await api().get(summaryPath);

    expect(response.status).toBe(401);
    expect(response.body.messageKey).toBe('errors.auth.tokenRequired');
  });

  it('shapes the member persona from the caller own grants', async () => {
    const token = await tokenFor(fixture.memberUserId, [Role.User]);

    const response = await api()
      .get(summaryPath)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.persona).toBe('member');
    expect(typeof response.body.generatedAt).toBe('string');
    expect(widgetKinds(response.body)).toEqual([
      'member-schedule',
      'member-attendance',
      'member-standing',
      'member-activity',
      'member-feedback',
      'member-profile',
    ]);
  });

  it('reports null, never zero, for a member with no history', async () => {
    const token = await tokenFor(fixture.memberUserId, [Role.User]);

    const response = await api()
      .get(summaryPath)
      .set('Authorization', `Bearer ${token}`);

    const standing = response.body.widgets.find(
      (widget: { kind: string }) => widget.kind === 'member-standing',
    );
    expect(standing.status).toBe('empty');
    expect(standing.metric.value).toBeNull();
    expect(standing.metric.displayValue).toBeNull();
    expect(standing.metric.unit).toBeNull();
    expect(standing.asOf).toBeNull();
  });

  it('gives every widget its own freshness stamp and display strings', async () => {
    const token = await tokenFor(fixture.memberUserId, [Role.User]);

    const response = await api()
      .get(summaryPath)
      .set('Authorization', `Bearer ${token}`);

    const profile = response.body.widgets.find(
      (widget: { kind: string }) => widget.kind === 'member-profile',
    );
    expect(profile.presentation).toBe('metric');
    expect(profile.status).toBe('ready');
    expect(profile.metric.displayValue).toMatch(/^\d+%$/u);
    expect(typeof profile.asOf).toBe('string');
  });

  it('adds the coach widgets for a scoped coach', async () => {
    const token = await tokenFor(fixture.coachUserId, [Role.User]);

    const response = await api()
      .get(summaryPath)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.persona).toBe('coach');
    expect(widgetKinds(response.body)).toContain('coach-sessions');
    expect(widgetKinds(response.body)).toContain('coach-attention');
    expect(widgetKinds(response.body)).toContain('coach-assessments');
    expect(widgetKinds(response.body)).not.toContain('admin-lifecycle');
  });

  it('adds the administrator widgets for a system administrator', async () => {
    const token = await tokenFor(fixture.adminId, [Role.Admin]);

    const response = await api()
      .get(summaryPath)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.persona).toBe('administrator');
    expect(widgetKinds(response.body)).toContain('admin-lifecycle');
  });

  it('honours an explicit team the caller belongs to', async () => {
    const token = await tokenFor(fixture.memberUserId, [Role.User]);

    const response = await api()
      .get(`${summaryPath}?teamId=${teamId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.persona).toBe('member');
  });

  it('denies a scoped member asking for another team (403)', async () => {
    const token = await tokenFor(fixture.memberUserId, [Role.User]);

    const response = await api()
      .get(`${summaryPath}?teamId=${otherTeamId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(403);
    expect(response.body.messageKey).toBe('errors.dashboard.teamForbidden');
  });

  it('denies a globally privileged principal a team they do not belong to', async () => {
    const token = await tokenFor(fixture.adminId, [Role.Admin]);

    const response = await api()
      .get(`${summaryPath}?teamId=${otherTeamId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(403);
    expect(response.body.messageKey).toBe('errors.dashboard.teamForbidden');
  });

  it('rejects a malformed team selector (400)', async () => {
    const token = await tokenFor(fixture.memberUserId, [Role.User]);

    const response = await api()
      .get(`${summaryPath}?teamId=not-a-uuid`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(400);
    expect(response.body.messageKey).toBe('errors.validation.failed');
  });
});
