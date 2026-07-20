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
import { RostersSchema1723500000000 } from '../src/database/migrations/1723500000000-rosters-schema';

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
  RostersSchema1723500000000,
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
  ? 'Rosters authorization matrix (e2e, PostgreSQL)'
  : `Rosters (e2e) (SKIPPED: test database unreachable at ${TEST_DB_HOST}:${TEST_DB_PORT})`;

describeIfDb(suiteTitle, () => {
  if (!seeded) {
    return;
  }
  const fixture: Fixture = seeded;
  let app: NestFastifyApplication;
  let teamId: string;
  let seasonId: string;
  let playerMembershipId: string;
  let reserveMembershipId: string;
  let suspendedMembershipId: string;
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

  async function seedCompetition(): Promise<string> {
    const id = randomUUID();
    await fixture.dataSource.query(
      `INSERT INTO "competitions" ("id", "team_id", "season_id", "name",
         "competition_type", "status")
       VALUES ($1, $2, $3, $4, 'championship', 'published')`,
      [id, teamId, seasonId, `Competition ${id.slice(0, 8)}`],
    );
    return id;
  }

  async function seedFixture(competitionId: string): Promise<string> {
    const opponentId = randomUUID();
    const fixtureId = randomUUID();
    await fixture.dataSource.query(
      `INSERT INTO "opponents" ("id", "team_id", "name") VALUES ($1, $2, $3)`,
      [opponentId, teamId, `Opponent ${opponentId.slice(0, 6)}`],
    );
    await fixture.dataSource.query(
      `INSERT INTO "fixtures" ("id", "competition_id", "team_id", "season_id",
         "opponent_id", "home_away", "scheduled_at")
       VALUES ($1, $2, $3, $4, $5, 'home', '2026-05-01T09:00:00.000Z')`,
      [fixtureId, competitionId, teamId, seasonId, opponentId],
    );
    return fixtureId;
  }

  async function seedMembership(
    userId: string | null,
    jerseyNumber: number | null,
    status = 'active',
  ): Promise<string> {
    const membershipId = randomUUID();
    await fixture.dataSource.query(
      `INSERT INTO "memberships" ("id", "team_id", "season_id", "user_id",
         "status")
       VALUES ($1, $2, $3, $4, $5)`,
      [membershipId, teamId, seasonId, userId, status],
    );
    await fixture.dataSource.query(
      `INSERT INTO "member_profiles" ("id", "membership_id", "team_id",
         "full_name", "gender", "jersey_number")
       VALUES ($1, $2, $3, $4, 'woman', $5)`,
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
    return `/api/v1/teams/${teamId}/rosters${path}`;
  }

  async function createRoster(token: string): Promise<request.Response> {
    const competitionId = await seedCompetition();
    return request(app.getHttpServer())
      .post(base(''))
      .set('Authorization', `Bearer ${token}`)
      .send({
        competitionId,
        name: `Roster ${randomUUID().slice(0, 8)}`,
        minSize: 1,
        maxSize: 20,
        requireCaptain: false,
      });
  }

  async function createRosterId(token: string): Promise<string> {
    const response = await createRoster(token);
    return response.body.rosterId;
  }

  async function addPlayer(
    token: string,
    rosterId: string,
  ): Promise<request.Response> {
    return request(app.getHttpServer())
      .post(base(`/${rosterId}/entries`))
      .set('Authorization', `Bearer ${token}`)
      .send({ membershipId: playerMembershipId });
  }

  async function publish(
    token: string,
    rosterId: string,
    expectedRecordVersion: number,
  ): Promise<request.Response> {
    return request(app.getHttpServer())
      .post(base(`/${rosterId}/transition`))
      .set('Authorization', `Bearer ${token}`)
      .send({ transition: 'publish', expectedRecordVersion });
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
    playerMembershipId = await seedMembership(fixture.memberId, 11);
    reserveMembershipId = await seedMembership(null, null);
    suspendedMembershipId = await seedMembership(null, 12, 'suspended');
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

  it('lets a coach create a draft competition roster (201, roster.manage)', async () => {
    const token = await tokenFor(fixture.coachId, [Role.User]);
    const response = await createRoster(token);
    expect(response.status).toBe(201);
    expect(response.body.status).toBe('draft');
    expect(response.body.rosterKind).toBe('competition');
    expect(response.body.revision).toBe(1);
    expect(response.body.policyVersion).toBe('roster-constraints-v1');
    expect(response.body.minWomen).toBeNull();
  });

  it('forbids a member from creating a roster (403 permissionDenied)', async () => {
    const token = await tokenFor(fixture.memberId, [Role.User]);
    const response = await createRoster(token);
    expect(response.status).toBe(403);
    expect(response.body.messageKey).toBe('errors.auth.permissionDenied');
  });

  it('rejects the roster list without a token (401 tokenRequired)', async () => {
    const response = await request(app.getHttpServer()).get(base(''));
    expect(response.status).toBe(401);
    expect(response.body.messageKey).toBe('errors.auth.tokenRequired');
  });

  it('lets a member read the roster list (200, roster.read)', async () => {
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
      .post(`/api/v1/teams/${otherTeamId}/rosters`)
      .set('Authorization', `Bearer ${token}`)
      .send({ competitionId: randomUUID(), name: 'Foreign Roster' });
    expect(response.status).toBe(403);
    expect(response.body.messageKey).toBe('errors.auth.permissionDenied');
  });

  it('hides another team’s roster from a scoped reader (404 rosterNotFound)', async () => {
    const coachToken = await tokenFor(fixture.coachId, [Role.User]);
    const rosterId = await createRosterId(coachToken);
    const token = await tokenFor(fixture.adminId, [Role.Admin]);
    const response = await request(app.getHttpServer())
      .get(`/api/v1/teams/${otherTeamId}/rosters/${rosterId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(404);
    expect(response.body.messageKey).toBe('errors.rosters.rosterNotFound');
  });

  it('lets a coach add an unflagged player (201)', async () => {
    const token = await tokenFor(fixture.coachId, [Role.User]);
    const rosterId = await createRosterId(token);
    const response = await addPlayer(token, rosterId);
    expect(response.status).toBe(201);
    expect(response.body.status).toBe('selected');
    expect(response.body.constraintOverridden).toBe(false);
    expect(response.body.genderBucket).toBe('women');
    expect(response.body.availability).toBeNull();
  });

  it('forbids a member from adding a player (403 permissionDenied)', async () => {
    const coachToken = await tokenFor(fixture.coachId, [Role.User]);
    const rosterId = await createRosterId(coachToken);
    const token = await tokenFor(fixture.memberId, [Role.User]);
    const response = await request(app.getHttpServer())
      .post(base(`/${rosterId}/entries`))
      .set('Authorization', `Bearer ${token}`)
      .send({ membershipId: playerMembershipId });
    expect(response.status).toBe(403);
    expect(response.body.messageKey).toBe('errors.auth.permissionDenied');
  });

  it('refuses a flagged player on the plain endpoint (409 overrideRequired)', async () => {
    const token = await tokenFor(fixture.coachId, [Role.User]);
    const rosterId = await createRosterId(token);
    const response = await request(app.getHttpServer())
      .post(base(`/${rosterId}/entries`))
      .set('Authorization', `Bearer ${token}`)
      .send({ membershipId: suspendedMembershipId });
    expect(response.status).toBe(409);
    expect(response.body.messageKey).toBe('errors.rosters.overrideRequired');
  });

  it('forbids overriding without the elevated permission (403)', async () => {
    const token = await tokenFor(fixture.coachId, [Role.User]);
    const rosterId = await createRosterId(token);
    const response = await request(app.getHttpServer())
      .post(base(`/${rosterId}/entries/override`))
      .set('Authorization', `Bearer ${token}`)
      .send({
        membershipId: suspendedMembershipId,
        overrideReason: 'coach judgement',
      });
    expect(response.status).toBe(403);
    expect(response.body.messageKey).toBe('errors.auth.permissionDenied');
  });

  it('rejects an override with no reason (400 validation.failed)', async () => {
    const coachToken = await tokenFor(fixture.coachId, [Role.User]);
    const rosterId = await createRosterId(coachToken);
    const token = await tokenFor(fixture.teamAdminId, [Role.User]);
    const response = await request(app.getHttpServer())
      .post(base(`/${rosterId}/entries/override`))
      .set('Authorization', `Bearer ${token}`)
      .send({ membershipId: suspendedMembershipId });
    expect(response.status).toBe(400);
    expect(response.body.messageKey).toBe('errors.validation.failed');
  });

  it('records an override with a reason for a permitted actor (201)', async () => {
    const coachToken = await tokenFor(fixture.coachId, [Role.User]);
    const rosterId = await createRosterId(coachToken);
    const token = await tokenFor(fixture.teamAdminId, [Role.User]);
    const response = await request(app.getHttpServer())
      .post(base(`/${rosterId}/entries/override`))
      .set('Authorization', `Bearer ${token}`)
      .send({
        membershipId: suspendedMembershipId,
        overrideReason: 'disciplinary review closed before the tournament',
      });
    expect(response.status).toBe(201);
    expect(response.body.constraintOverridden).toBe(true);
    expect(response.body.overrideReason).toBe(
      'disciplinary review closed before the tournament',
    );
    expect(response.body.overriddenBy).toBe(fixture.teamAdminId);
  });

  it('rejects a jersey another selected player already wears (409)', async () => {
    const token = await tokenFor(fixture.coachId, [Role.User]);
    const rosterId = await createRosterId(token);
    await addPlayer(token, rosterId);
    const response = await request(app.getHttpServer())
      .post(base(`/${rosterId}/entries`))
      .set('Authorization', `Bearer ${token}`)
      .send({ membershipId: reserveMembershipId, jerseyNumber: 11 });
    expect(response.status).toBe(409);
    expect(response.body.messageKey).toBe('errors.rosters.jerseyConflict');
  });

  it('rejects an unreachable roster transition (409 rosterInvalidTransition)', async () => {
    const token = await tokenFor(fixture.coachId, [Role.User]);
    const created = await createRoster(token);
    await addPlayer(token, created.body.rosterId);
    const published = await publish(
      token,
      created.body.rosterId,
      created.body.recordVersion,
    );
    expect(published.status).toBe(200);
    const again = await publish(
      token,
      created.body.rosterId,
      published.body.recordVersion,
    );
    expect(again.status).toBe(409);
    expect(again.body.messageKey).toBe(
      'errors.rosters.rosterInvalidTransition',
    );
  });

  it('refuses to publish a roster that breaks a composition rule (409)', async () => {
    const token = await tokenFor(fixture.coachId, [Role.User]);
    const created = await createRoster(token);
    const response = await publish(
      token,
      created.body.rosterId,
      created.body.recordVersion,
    );
    expect(response.status).toBe(409);
    expect(response.body.messageKey).toBe('errors.rosters.rosterConstraint');
  });

  it('rejects a stale optimistic version on publish (409 rosterVersionConflict)', async () => {
    const token = await tokenFor(fixture.coachId, [Role.User]);
    const created = await createRoster(token);
    await addPlayer(token, created.body.rosterId);
    const response = await publish(
      token,
      created.body.rosterId,
      Number(created.body.recordVersion) + 99,
    );
    expect(response.status).toBe(409);
    expect(response.body.messageKey).toBe(
      'errors.rosters.rosterVersionConflict',
    );
  });

  it('forbids a coach from locking a roster (403, roster.lock is elevated)', async () => {
    const token = await tokenFor(fixture.coachId, [Role.User]);
    const created = await createRoster(token);
    await addPlayer(token, created.body.rosterId);
    const published = await publish(
      token,
      created.body.rosterId,
      created.body.recordVersion,
    );
    const response = await request(app.getHttpServer())
      .post(base(`/${created.body.rosterId}/lock`))
      .set('Authorization', `Bearer ${token}`)
      .send({ expectedRecordVersion: published.body.recordVersion });
    expect(response.status).toBe(403);
    expect(response.body.messageKey).toBe('errors.auth.permissionDenied');
  });

  it('lets a team admin lock a published roster and freezes it (200 then 409)', async () => {
    const coachToken = await tokenFor(fixture.coachId, [Role.User]);
    const adminToken = await tokenFor(fixture.teamAdminId, [Role.User]);
    const created = await createRoster(coachToken);
    await addPlayer(coachToken, created.body.rosterId);
    const published = await publish(
      coachToken,
      created.body.rosterId,
      created.body.recordVersion,
    );
    const locked = await request(app.getHttpServer())
      .post(base(`/${created.body.rosterId}/lock`))
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ expectedRecordVersion: published.body.recordVersion });
    expect(locked.status).toBe(200);
    expect(locked.body.status).toBe('locked');
    expect(locked.body.lockedBy).toBe(fixture.teamAdminId);
    expect(locked.body.currentSnapshotId).not.toBeNull();
    const frozen = await request(app.getHttpServer())
      .post(base(`/${created.body.rosterId}/entries`))
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ membershipId: suspendedMembershipId });
    expect(frozen.status).toBe(409);
    expect(frozen.body.messageKey).toBe('errors.rosters.rosterLocked');
    const withdrawn = await request(app.getHttpServer())
      .post(
        base(`/${created.body.rosterId}/entries/${playerMembershipId}/removal`),
      )
      .set('Authorization', `Bearer ${coachToken}`)
      .send({});
    expect(withdrawn.status).toBe(409);
    expect(withdrawn.body.messageKey).toBe('errors.rosters.rosterLocked');
  });

  it('exposes the immutable snapshots of a locked roster (200, roster.read)', async () => {
    const coachToken = await tokenFor(fixture.coachId, [Role.User]);
    const adminToken = await tokenFor(fixture.teamAdminId, [Role.User]);
    const created = await createRoster(coachToken);
    await addPlayer(coachToken, created.body.rosterId);
    const published = await publish(
      coachToken,
      created.body.rosterId,
      created.body.recordVersion,
    );
    await request(app.getHttpServer())
      .post(base(`/${created.body.rosterId}/lock`))
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ expectedRecordVersion: published.body.recordVersion });
    const memberToken = await tokenFor(fixture.memberId, [Role.User]);
    const response = await request(app.getHttpServer())
      .get(base(`/${created.body.rosterId}/snapshots`))
      .set('Authorization', `Bearer ${memberToken}`);
    expect(response.status).toBe(200);
    expect(response.body.total).toBe(2);
    expect(
      response.body.items.map((item: { reason: string }) => item.reason).sort(),
    ).toEqual(['locked', 'published']);
    const locked = response.body.items.find(
      (item: { reason: string }) => item.reason === 'locked',
    );
    expect(locked.entryCount).toBe(1);
    expect(locked.entries[0].membershipId).toBe(playerMembershipId);
    expect(Object.keys(locked.entries[0])).toEqual([
      'membershipId',
      'jerseyNumber',
      'entryRole',
      'lineAssignment',
      'fieldPosition',
      'genderBucket',
      'availability',
      'constraintOverridden',
    ]);
  });

  it('forbids a coach from superseding a locked roster (403, needs roster.lock)', async () => {
    const coachToken = await tokenFor(fixture.coachId, [Role.User]);
    const created = await createRoster(coachToken);
    await addPlayer(coachToken, created.body.rosterId);
    const published = await publish(
      coachToken,
      created.body.rosterId,
      created.body.recordVersion,
    );
    const response = await request(app.getHttpServer())
      .post(base(`/${created.body.rosterId}/revision`))
      .set('Authorization', `Bearer ${coachToken}`)
      .send({
        reason: 'injury replacement',
        expectedRecordVersion: published.body.recordVersion,
      });
    expect(response.status).toBe(403);
    expect(response.body.messageKey).toBe('errors.auth.permissionDenied');
  });

  it('supersedes a locked roster with a new revision instead of editing it (201)', async () => {
    const coachToken = await tokenFor(fixture.coachId, [Role.User]);
    const adminToken = await tokenFor(fixture.teamAdminId, [Role.User]);
    const created = await createRoster(coachToken);
    await addPlayer(coachToken, created.body.rosterId);
    const published = await publish(
      coachToken,
      created.body.rosterId,
      created.body.recordVersion,
    );
    const locked = await request(app.getHttpServer())
      .post(base(`/${created.body.rosterId}/lock`))
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ expectedRecordVersion: published.body.recordVersion });
    const revision = await request(app.getHttpServer())
      .post(base(`/${created.body.rosterId}/revision`))
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        reason: 'injury replacement',
        expectedRecordVersion: locked.body.recordVersion,
      });
    expect(revision.status).toBe(201);
    expect(revision.body.rosterId).not.toBe(created.body.rosterId);
    expect(revision.body.status).toBe('draft');
    expect(revision.body.revision).toBe(2);
    expect(revision.body.supersedesRosterId).toBe(created.body.rosterId);
    const superseded = await request(app.getHttpServer())
      .get(base(`/${created.body.rosterId}`))
      .set('Authorization', `Bearer ${coachToken}`);
    expect(superseded.body.status).toBe('revised');
    expect(superseded.body.revisionReason).toBe('injury replacement');
    const carried = await request(app.getHttpServer())
      .get(base(`/${revision.body.rosterId}/entries`))
      .set('Authorization', `Bearer ${coachToken}`);
    expect(carried.body.total).toBe(1);
    expect(carried.body.items[0].membershipId).toBe(playerMembershipId);
  });

  it('rejects a revision with no reason (400 validation.failed)', async () => {
    const coachToken = await tokenFor(fixture.coachId, [Role.User]);
    const adminToken = await tokenFor(fixture.teamAdminId, [Role.User]);
    const created = await createRoster(coachToken);
    await addPlayer(coachToken, created.body.rosterId);
    const published = await publish(
      coachToken,
      created.body.rosterId,
      created.body.recordVersion,
    );
    const response = await request(app.getHttpServer())
      .post(base(`/${created.body.rosterId}/revision`))
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ expectedRecordVersion: published.body.recordVersion });
    expect(response.status).toBe(400);
    expect(response.body.messageKey).toBe('errors.validation.failed');
  });

  it('creates a match roster copied from a competition roster (201)', async () => {
    const token = await tokenFor(fixture.coachId, [Role.User]);
    const competitionId = await seedCompetition();
    const fixtureId = await seedFixture(competitionId);
    const source = await request(app.getHttpServer())
      .post(base(''))
      .set('Authorization', `Bearer ${token}`)
      .send({
        competitionId,
        name: `Source ${randomUUID().slice(0, 8)}`,
        minSize: 1,
        requireCaptain: false,
      });
    await addPlayer(token, source.body.rosterId);
    const response = await request(app.getHttpServer())
      .post(base('/match'))
      .set('Authorization', `Bearer ${token}`)
      .send({
        fixtureId,
        sourceRosterId: source.body.rosterId,
        name: 'Game 1',
        minSize: 1,
        requireCaptain: false,
      });
    expect(response.status).toBe(201);
    expect(response.body.rosterKind).toBe('match');
    expect(response.body.fixtureId).toBe(fixtureId);
    const entries = await request(app.getHttpServer())
      .get(base(`/${response.body.rosterId}/entries`))
      .set('Authorization', `Bearer ${token}`);
    expect(entries.body.total).toBe(1);
  });

  it('hides a fixture from another team behind a not-found scope (404)', async () => {
    const token = await tokenFor(fixture.coachId, [Role.User]);
    const response = await request(app.getHttpServer())
      .post(base('/match'))
      .set('Authorization', `Bearer ${token}`)
      .send({ fixtureId: randomUUID(), name: 'Ghost Game' });
    expect(response.status).toBe(404);
    expect(response.body.messageKey).toBe('errors.rosters.scopeNotFound');
  });

  it('lets a member declare their own availability (201, identity from token)', async () => {
    const coachToken = await tokenFor(fixture.coachId, [Role.User]);
    const rosterId = await createRosterId(coachToken);
    const token = await tokenFor(fixture.memberId, [Role.User]);
    const response = await request(app.getHttpServer())
      .post(base(`/${rosterId}/availability`))
      .set('Authorization', `Bearer ${token}`)
      .send({ availability: 'unavailable' });
    expect(response.status).toBe(201);
    expect(response.body.membershipId).toBe(playerMembershipId);
    expect(response.body.source).toBe('self');
  });

  it('rejects an invalid availability value (400 validation.failed)', async () => {
    const coachToken = await tokenFor(fixture.coachId, [Role.User]);
    const rosterId = await createRosterId(coachToken);
    const token = await tokenFor(fixture.memberId, [Role.User]);
    const response = await request(app.getHttpServer())
      .post(base(`/${rosterId}/availability`))
      .set('Authorization', `Bearer ${token}`)
      .send({ availability: 'maybe' });
    expect(response.status).toBe(400);
    expect(response.body.messageKey).toBe('errors.validation.failed');
  });

  it('previews the server-side composition validation (200, roster.read)', async () => {
    const coachToken = await tokenFor(fixture.coachId, [Role.User]);
    const created = await createRoster(coachToken);
    await addPlayer(coachToken, created.body.rosterId);
    const token = await tokenFor(fixture.memberId, [Role.User]);
    const response = await request(app.getHttpServer())
      .get(base(`/${created.body.rosterId}/validation`))
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(response.body.policyVersion).toBe('roster-constraints-v1');
    expect(response.body.publishable).toBe(true);
    expect(response.body.composition.selected).toBe(1);
    expect(response.body.composition.women).toBe(1);
  });

  it('keeps a withdrawn player in the entry list (200, zero-contribution export)', async () => {
    const token = await tokenFor(fixture.coachId, [Role.User]);
    const created = await createRoster(token);
    await addPlayer(token, created.body.rosterId);
    const removed = await request(app.getHttpServer())
      .post(
        base(`/${created.body.rosterId}/entries/${playerMembershipId}/removal`),
      )
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'travelling' });
    expect(removed.status).toBe(200);
    expect(removed.body.status).toBe('withdrawn');
    const entries = await request(app.getHttpServer())
      .get(base(`/${created.body.rosterId}/entries`))
      .set('Authorization', `Bearer ${token}`);
    expect(entries.body.total).toBe(1);
    expect(entries.body.items[0].status).toBe('withdrawn');
    expect(entries.body.items[0].removalReason).toBe('travelling');
  });

  it('rejects a malformed roster id (400 invalid uuid)', async () => {
    const token = await tokenFor(fixture.coachId, [Role.User]);
    const response = await request(app.getHttpServer())
      .get(base('/not-a-uuid'))
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(400);
  });
});
