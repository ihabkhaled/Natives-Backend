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
import { CompetitionsSchema1723300000000 } from '../src/database/migrations/1723300000000-competitions-schema';
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
  ActivitiesSchema1722900000000,
  ActivityReviewSchema1723000000000,
  PointsSchema1723100000000,
  LeaderboardIndexes1723200000000,
  CompetitionsSchema1723300000000,
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
  ? 'Competitions authorization matrix (e2e, PostgreSQL)'
  : `Competitions (e2e) (SKIPPED: test database unreachable at ${TEST_DB_HOST}:${TEST_DB_PORT})`;

describeIfDb(suiteTitle, () => {
  if (!seeded) {
    return;
  }
  const fixture: Fixture = seeded;
  let app: NestFastifyApplication;
  let teamId: string;
  let seasonId: string;
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

  async function seedSeason(): Promise<string> {
    const id = randomUUID();
    await fixture.dataSource.query(
      `INSERT INTO "seasons" ("id", "team_id", "slug", "name", "starts_on",
         "ends_on", "status")
       VALUES ($1, $2, $3, 'Season', '2026-01-01', '2026-12-31', 'active')`,
      [id, teamId, `s-${id.slice(0, 8)}`],
    );
    return id;
  }

  function base(path: string): string {
    return `/api/v1/teams/${teamId}/competitions${path}`;
  }

  function competitionBody(): Record<string, unknown> {
    return {
      name: `League ${randomUUID().slice(0, 8)}`,
      competitionType: 'league',
      seasonId,
      startsOn: '2026-01-01',
      endsOn: '2026-06-01',
    };
  }

  async function createCompetition(token: string): Promise<request.Response> {
    return request(app.getHttpServer())
      .post(base(''))
      .set('Authorization', `Bearer ${token}`)
      .send(competitionBody());
  }

  async function createOpponent(token: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .post(`/api/v1/teams/${teamId}/opponents`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `Opp ${randomUUID().slice(0, 8)}` });
    return response.body.opponentId;
  }

  async function bookFixture(
    token: string,
    competitionId: string,
    opponentId: string,
  ): Promise<request.Response> {
    return request(app.getHttpServer())
      .post(base(`/${competitionId}/fixtures`))
      .set('Authorization', `Bearer ${token}`)
      .send({
        opponentId,
        homeAway: 'home',
        scheduledAt: '2026-02-15T18:30:00.000Z',
      });
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
    seasonId = await seedSeason();
    await assignRole(fixture.coachId, RbacRole.Coach);
    await assignRole(fixture.memberId, RbacRole.Member);
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

  it('lets a coach create a competition (201, competition.manage)', async () => {
    const token = await tokenFor(fixture.coachId, [Role.User]);
    const response = await createCompetition(token);
    expect(response.status).toBe(201);
    expect(response.body.status).toBe('draft');
  });

  it('lets an administrator create a competition (201)', async () => {
    const token = await tokenFor(fixture.adminId, [Role.Admin]);
    const response = await createCompetition(token);
    expect(response.status).toBe(201);
  });

  it('lets a member read the competitions list (200, competition.read)', async () => {
    const token = await tokenFor(fixture.memberId, [Role.User]);
    const response = await request(app.getHttpServer())
      .get(base(''))
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.items)).toBe(true);
  });

  it('forbids a member from creating a competition (403)', async () => {
    const token = await tokenFor(fixture.memberId, [Role.User]);
    const response = await createCompetition(token);
    expect(response.status).toBe(403);
    expect(response.body.messageKey).toBe('errors.auth.permissionDenied');
  });

  it('rejects the list without a token (401 tokenRequired)', async () => {
    const response = await request(app.getHttpServer()).get(base(''));
    expect(response.status).toBe(401);
    expect(response.body.messageKey).toBe('errors.auth.tokenRequired');
  });

  it('denies a coach managing a different team (403, team-scoped)', async () => {
    const token = await tokenFor(fixture.coachId, [Role.User]);
    const response = await request(app.getHttpServer())
      .post(`/api/v1/teams/${otherTeamId}/competitions`)
      .set('Authorization', `Bearer ${token}`)
      .send(competitionBody());
    expect(response.status).toBe(403);
    expect(response.body.messageKey).toBe('errors.auth.permissionDenied');
  });

  it('rejects an invalid competition transition (409 invalidTransition)', async () => {
    const token = await tokenFor(fixture.coachId, [Role.User]);
    const created = await createCompetition(token);
    const response = await request(app.getHttpServer())
      .post(base(`/${created.body.competitionId}/transition`))
      .set('Authorization', `Bearer ${token}`)
      .send({
        transition: 'complete',
        expectedRecordVersion: created.body.recordVersion,
      });
    expect(response.status).toBe(409);
    expect(response.body.messageKey).toBe(
      'errors.competitions.competitionInvalidTransition',
    );
  });

  it('requires a reason to cancel (400 validation)', async () => {
    const token = await tokenFor(fixture.coachId, [Role.User]);
    const created = await createCompetition(token);
    const response = await request(app.getHttpServer())
      .post(base(`/${created.body.competitionId}/transition`))
      .set('Authorization', `Bearer ${token}`)
      .send({
        transition: 'cancel',
        expectedRecordVersion: created.body.recordVersion,
      });
    expect(response.status).toBe(400);
    expect(response.body.messageKey).toBe('errors.competitions.validation');
  });

  it('reschedules a fixture and presents it in Cairo (200)', async () => {
    const token = await tokenFor(fixture.coachId, [Role.User]);
    const created = await createCompetition(token);
    const opponentId = await createOpponent(token);
    const booked = await bookFixture(
      token,
      created.body.competitionId,
      opponentId,
    );
    expect(booked.status).toBe(201);
    expect(booked.body.scheduledAtCairo).toBe('2026-02-15T20:30');
    const moved = await request(app.getHttpServer())
      .post(
        base(
          `/${created.body.competitionId}/fixtures/${booked.body.fixtureId}/reschedule`,
        ),
      )
      .set('Authorization', `Bearer ${token}`)
      .send({
        scheduledAt: '2026-03-01T18:30:00.000Z',
        expectedRecordVersion: booked.body.recordVersion,
      });
    expect(moved.status).toBe(200);
    expect(moved.body.status).toBe('rescheduled');
  });

  it('rejects an invalid fixture transition (409 fixtureInvalidTransition)', async () => {
    const token = await tokenFor(fixture.coachId, [Role.User]);
    const created = await createCompetition(token);
    const opponentId = await createOpponent(token);
    const booked = await bookFixture(
      token,
      created.body.competitionId,
      opponentId,
    );
    const response = await request(app.getHttpServer())
      .post(
        base(
          `/${created.body.competitionId}/fixtures/${booked.body.fixtureId}/transition`,
        ),
      )
      .set('Authorization', `Bearer ${token}`)
      .send({
        transition: 'finalize',
        expectedRecordVersion: booked.body.recordVersion,
      });
    expect(response.status).toBe(409);
    expect(response.body.messageKey).toBe(
      'errors.competitions.fixtureInvalidTransition',
    );
  });

  it('cancels a competition but keeps its historical fixtures (200)', async () => {
    const token = await tokenFor(fixture.coachId, [Role.User]);
    const created = await createCompetition(token);
    const opponentId = await createOpponent(token);
    const booked = await bookFixture(
      token,
      created.body.competitionId,
      opponentId,
    );
    const cancelled = await request(app.getHttpServer())
      .post(base(`/${created.body.competitionId}/transition`))
      .set('Authorization', `Bearer ${token}`)
      .send({
        transition: 'cancel',
        expectedRecordVersion: created.body.recordVersion,
        reason: 'season abandoned',
      });
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.status).toBe('cancelled');
    const fixtures = await request(app.getHttpServer())
      .get(base(`/${created.body.competitionId}/fixtures`))
      .set('Authorization', `Bearer ${token}`);
    expect(fixtures.status).toBe(200);
    const kept = fixtures.body.items.find(
      (row: { fixtureId: string }) => row.fixtureId === booked.body.fixtureId,
    );
    expect(kept).toBeDefined();
  });
});
