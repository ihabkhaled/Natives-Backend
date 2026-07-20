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
import { SquadsSchema1723400000000 } from '../src/database/migrations/1723400000000-squads-schema';

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
  SquadsSchema1723400000000,
];

interface Fixture {
  readonly dataSource: DataSource;
  readonly adminId: string;
  readonly coachId: string;
  readonly teamAdminId: string;
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
      teamAdminId: await seedUser(dataSource, Role.User),
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
  ? 'Squads authorization matrix (e2e, PostgreSQL)'
  : `Squads (e2e) (SKIPPED: test database unreachable at ${TEST_DB_HOST}:${TEST_DB_PORT})`;

describeIfDb(suiteTitle, () => {
  if (!seeded) {
    return;
  }
  const fixture: Fixture = seeded;
  let app: NestFastifyApplication;
  let teamId: string;
  let seasonId: string;
  let clearMembershipId: string;
  let flaggedMembershipId: string;
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

  async function seedMembership(
    userId: string | null,
    jerseyNumber: number | null,
  ): Promise<string> {
    const membershipId = randomUUID();
    await fixture.dataSource.query(
      `INSERT INTO "memberships" ("id", "team_id", "season_id", "user_id",
         "status")
       VALUES ($1, $2, $3, $4, 'active')`,
      [membershipId, teamId, seasonId, userId],
    );
    await fixture.dataSource.query(
      `INSERT INTO "member_profiles" ("id", "membership_id", "team_id",
         "full_name", "jersey_number")
       VALUES ($1, $2, $3, $4, $5)`,
      [
        randomUUID(),
        membershipId,
        teamId,
        `Player ${membershipId.slice(0, 6)}`,
        jerseyNumber,
      ],
    );
    return membershipId;
  }

  function base(path: string): string {
    return `/api/v1/teams/${teamId}/squads${path}`;
  }

  function squadBody(): Record<string, unknown> {
    return {
      name: `Squad ${randomUUID().slice(0, 8)}`,
      seasonId,
      attendanceThresholdPct: 70,
    };
  }

  async function createSquad(token: string): Promise<request.Response> {
    return request(app.getHttpServer())
      .post(base(''))
      .set('Authorization', `Bearer ${token}`)
      .send(squadBody());
  }

  async function createSquadId(token: string): Promise<string> {
    const response = await createSquad(token);
    return response.body.squadId;
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
    await assignRole(fixture.teamAdminId, RbacRole.TeamAdmin);
    await assignRole(fixture.memberId, RbacRole.Member);
    clearMembershipId = await seedMembership(fixture.memberId, 11);
    flaggedMembershipId = await seedMembership(null, null);
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

  it('lets a coach create a draft squad (201, squad.manage)', async () => {
    const token = await tokenFor(fixture.coachId, [Role.User]);
    const response = await createSquad(token);
    expect(response.status).toBe(201);
    expect(response.body.status).toBe('draft');
    expect(response.body.policyVersion).toBe('eligibility-signals-v1');
  });

  it('forbids a member from creating a squad (403 permissionDenied)', async () => {
    const token = await tokenFor(fixture.memberId, [Role.User]);
    const response = await createSquad(token);
    expect(response.status).toBe(403);
    expect(response.body.messageKey).toBe('errors.auth.permissionDenied');
  });

  it('rejects the squad list without a token (401 tokenRequired)', async () => {
    const response = await request(app.getHttpServer()).get(base(''));
    expect(response.status).toBe(401);
    expect(response.body.messageKey).toBe('errors.auth.tokenRequired');
  });

  it('lets a member read the squad list (200, squad.read)', async () => {
    const token = await tokenFor(fixture.memberId, [Role.User]);
    const response = await request(app.getHttpServer())
      .get(base(''))
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.items)).toBe(true);
  });

  it('denies a coach managing a different team (403, team-scoped)', async () => {
    const token = await tokenFor(fixture.coachId, [Role.User]);
    const response = await request(app.getHttpServer())
      .post(`/api/v1/teams/${otherTeamId}/squads`)
      .set('Authorization', `Bearer ${token}`)
      .send(squadBody());
    expect(response.status).toBe(403);
    expect(response.body.messageKey).toBe('errors.auth.permissionDenied');
  });

  it('lets a coach select a clear candidate (201, no override needed)', async () => {
    const token = await tokenFor(fixture.coachId, [Role.User]);
    const squadId = await createSquadId(token);
    const response = await request(app.getHttpServer())
      .post(base(`/${squadId}/selections`))
      .set('Authorization', `Bearer ${token}`)
      .send({ membershipId: clearMembershipId });
    expect(response.status).toBe(201);
    expect(response.body.eligibilityOverridden).toBe(false);
    expect(response.body.status).toBe('selected');
  });

  it('forbids a member from selecting a player (403 permissionDenied)', async () => {
    const coachToken = await tokenFor(fixture.coachId, [Role.User]);
    const squadId = await createSquadId(coachToken);
    const token = await tokenFor(fixture.memberId, [Role.User]);
    const response = await request(app.getHttpServer())
      .post(base(`/${squadId}/selections`))
      .set('Authorization', `Bearer ${token}`)
      .send({ membershipId: clearMembershipId });
    expect(response.status).toBe(403);
    expect(response.body.messageKey).toBe('errors.auth.permissionDenied');
  });

  it('refuses a flagged candidate on the plain endpoint (409 overrideRequired)', async () => {
    const token = await tokenFor(fixture.coachId, [Role.User]);
    const squadId = await createSquadId(token);
    const response = await request(app.getHttpServer())
      .post(base(`/${squadId}/selections`))
      .set('Authorization', `Bearer ${token}`)
      .send({ membershipId: flaggedMembershipId });
    expect(response.status).toBe(409);
    expect(response.body.messageKey).toBe(
      'errors.squads.eligibilityOverrideRequired',
    );
  });

  it('forbids overriding without squad.override_eligibility (403)', async () => {
    const token = await tokenFor(fixture.coachId, [Role.User]);
    const squadId = await createSquadId(token);
    const response = await request(app.getHttpServer())
      .post(base(`/${squadId}/selections/override`))
      .set('Authorization', `Bearer ${token}`)
      .send({
        membershipId: flaggedMembershipId,
        overrideReason: 'coach judgement',
      });
    expect(response.status).toBe(403);
    expect(response.body.messageKey).toBe('errors.auth.permissionDenied');
  });

  it('rejects an override with no reason (400 validation.failed)', async () => {
    const coachToken = await tokenFor(fixture.coachId, [Role.User]);
    const squadId = await createSquadId(coachToken);
    const token = await tokenFor(fixture.teamAdminId, [Role.User]);
    const response = await request(app.getHttpServer())
      .post(base(`/${squadId}/selections/override`))
      .set('Authorization', `Bearer ${token}`)
      .send({ membershipId: flaggedMembershipId });
    expect(response.status).toBe(400);
    expect(response.body.messageKey).toBe('errors.validation.failed');
  });

  it('records an override with a reason for a permitted actor (201)', async () => {
    const coachToken = await tokenFor(fixture.coachId, [Role.User]);
    const squadId = await createSquadId(coachToken);
    const token = await tokenFor(fixture.teamAdminId, [Role.User]);
    const response = await request(app.getHttpServer())
      .post(base(`/${squadId}/selections/override`))
      .set('Authorization', `Bearer ${token}`)
      .send({
        membershipId: flaggedMembershipId,
        overrideReason: 'no jersey issued yet; squad needs the handler',
      });
    expect(response.status).toBe(201);
    expect(response.body.eligibilityOverridden).toBe(true);
    expect(response.body.overrideReason).toBe(
      'no jersey issued yet; squad needs the handler',
    );
    expect(response.body.overriddenBy).toBe(fixture.teamAdminId);
    expect(response.body.eligibilitySnapshot).toContain('overridden');
  });

  it('rejects an unreachable squad transition (409 squadInvalidTransition)', async () => {
    const token = await tokenFor(fixture.coachId, [Role.User]);
    const created = await createSquad(token);
    const response = await request(app.getHttpServer())
      .post(base(`/${created.body.squadId}/transition`))
      .set('Authorization', `Bearer ${token}`)
      .send({
        transition: 'lock',
        expectedRecordVersion: created.body.recordVersion,
      });
    expect(response.status).toBe(409);
    expect(response.body.messageKey).toBe(
      'errors.squads.squadInvalidTransition',
    );
  });

  it('rejects a stale optimistic version on publish (409 squadVersionConflict)', async () => {
    const token = await tokenFor(fixture.coachId, [Role.User]);
    const created = await createSquad(token);
    const response = await request(app.getHttpServer())
      .post(base(`/${created.body.squadId}/transition`))
      .set('Authorization', `Bearer ${token}`)
      .send({
        transition: 'publish',
        expectedRecordVersion: Number(created.body.recordVersion) + 99,
      });
    expect(response.status).toBe(409);
    expect(response.body.messageKey).toBe('errors.squads.squadVersionConflict');
  });

  it('publishes then locks a squad and freezes its selection (409 squadLocked)', async () => {
    const token = await tokenFor(fixture.coachId, [Role.User]);
    const created = await createSquad(token);
    const squadId = created.body.squadId;
    const published = await request(app.getHttpServer())
      .post(base(`/${squadId}/transition`))
      .set('Authorization', `Bearer ${token}`)
      .send({
        transition: 'publish',
        expectedRecordVersion: created.body.recordVersion,
      });
    expect(published.status).toBe(200);
    expect(published.body.status).toBe('published');
    const locked = await request(app.getHttpServer())
      .post(base(`/${squadId}/transition`))
      .set('Authorization', `Bearer ${token}`)
      .send({
        transition: 'lock',
        expectedRecordVersion: published.body.recordVersion,
      });
    expect(locked.status).toBe(200);
    const frozen = await request(app.getHttpServer())
      .post(base(`/${squadId}/selections`))
      .set('Authorization', `Bearer ${token}`)
      .send({ membershipId: clearMembershipId });
    expect(frozen.status).toBe(409);
    expect(frozen.body.messageKey).toBe('errors.squads.squadLocked');
  });

  it('hides another team’s squad from a scoped reader (404 squadNotFound)', async () => {
    const coachToken = await tokenFor(fixture.coachId, [Role.User]);
    const squadId = await createSquadId(coachToken);
    const token = await tokenFor(fixture.adminId, [Role.Admin]);
    const response = await request(app.getHttpServer())
      .get(`/api/v1/teams/${otherTeamId}/squads/${squadId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(404);
    expect(response.body.messageKey).toBe('errors.squads.squadNotFound');
  });

  it('lets a member declare their own availability (201, identity from token)', async () => {
    const coachToken = await tokenFor(fixture.coachId, [Role.User]);
    const squadId = await createSquadId(coachToken);
    const token = await tokenFor(fixture.memberId, [Role.User]);
    const response = await request(app.getHttpServer())
      .post(base(`/${squadId}/availability`))
      .set('Authorization', `Bearer ${token}`)
      .send({ availability: 'available' });
    expect(response.status).toBe(201);
    expect(response.body.membershipId).toBe(clearMembershipId);
    expect(response.body.source).toBe('self');
  });

  it('rejects an invalid availability value (400 validation.failed)', async () => {
    const coachToken = await tokenFor(fixture.coachId, [Role.User]);
    const squadId = await createSquadId(coachToken);
    const token = await tokenFor(fixture.memberId, [Role.User]);
    const response = await request(app.getHttpServer())
      .post(base(`/${squadId}/availability`))
      .set('Authorization', `Bearer ${token}`)
      .send({ availability: 'maybe' });
    expect(response.status).toBe(400);
    expect(response.body.messageKey).toBe('errors.validation.failed');
  });

  it('reports advisory eligibility signals without excluding anyone (200)', async () => {
    const token = await tokenFor(fixture.coachId, [Role.User]);
    const squadId = await createSquadId(token);
    const response = await request(app.getHttpServer())
      .get(base(`/${squadId}/eligibility`))
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(response.body.policyVersion).toBe('eligibility-signals-v1');
    const flagged = response.body.candidates.find(
      (row: { membershipId: string }) =>
        row.membershipId === flaggedMembershipId,
    );
    expect(flagged.flagged).toBe(true);
    expect(flagged.attendancePct).toBeNull();
    expect(
      flagged.signals.map((row: { code: string }) => row.code).sort(),
    ).toEqual([
      'active_status',
      'attendance',
      'availability',
      'injury',
      'jersey',
      'registration',
    ]);
  });

  it('rejects a malformed squad id (400 invalid uuid)', async () => {
    const token = await tokenFor(fixture.coachId, [Role.User]);
    const response = await request(app.getHttpServer())
      .get(base('/not-a-uuid'))
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(400);
  });
});
