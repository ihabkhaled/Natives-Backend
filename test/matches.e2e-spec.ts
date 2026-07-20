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
import { MatchesSchema1723600000000 } from '../src/database/migrations/1723600000000-matches-schema';

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
  MatchesSchema1723600000000,
];

interface Fixture {
  readonly dataSource: DataSource;
  readonly adminId: string;
  readonly coachId: string;
  readonly teamAdminId: string;
  readonly memberId: string;
  readonly scorekeeperId: string;
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
      scorekeeperId: await seedUser(dataSource, Role.User),
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
  ? 'Matches authorization matrix (e2e, PostgreSQL)'
  : `Matches (e2e) (SKIPPED: test database unreachable at ${TEST_DB_HOST}:${TEST_DB_PORT})`;

describeIfDb(suiteTitle, () => {
  if (!seeded) {
    return;
  }
  const fixture: Fixture = seeded;
  let app: NestFastifyApplication;
  let teamId: string;
  let seasonId: string;
  let competitionId: string;
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

  async function seedFixture(): Promise<string> {
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

  function base(path: string): string {
    return `/api/v1/teams/${teamId}/matches${path}`;
  }

  function operationId(): string {
    return `op-${randomUUID()}`;
  }

  async function createMatch(token: string): Promise<request.Response> {
    const fixtureId = await seedFixture();
    return request(app.getHttpServer())
      .post(base(''))
      .set('Authorization', `Bearer ${token}`)
      .send({ fixtureId });
  }

  async function transition(
    token: string,
    matchId: string,
    verb: string,
    expectedRecordVersion: number,
    reason?: string,
  ): Promise<request.Response> {
    return request(app.getHttpServer())
      .post(base(`/${matchId}/transition`))
      .set('Authorization', `Bearer ${token}`)
      .send({ transition: verb, expectedRecordVersion, reason });
  }

  async function liveMatch(): Promise<{ matchId: string; version: number }> {
    const coachToken = await tokenFor(fixture.coachId, [Role.User]);
    const created = await createMatch(coachToken);
    const ready = await transition(
      coachToken,
      created.body.matchId,
      'ready',
      created.body.recordVersion,
    );
    const live = await transition(
      coachToken,
      created.body.matchId,
      'start',
      ready.body.recordVersion,
    );
    return { matchId: created.body.matchId, version: live.body.recordVersion };
  }

  async function scorePoint(
    token: string,
    matchId: string,
    side = 'us',
    points = 1,
  ): Promise<request.Response> {
    return request(app.getHttpServer())
      .post(base(`/${matchId}/events/point`))
      .set('Authorization', `Bearer ${token}`)
      .send({ operationId: operationId(), scoringSide: side, points });
  }

  async function finalizedMatch(): Promise<{
    matchId: string;
    version: number;
  }> {
    const coachToken = await tokenFor(fixture.coachId, [Role.User]);
    const adminToken = await tokenFor(fixture.teamAdminId, [Role.User]);
    const keeperToken = await tokenFor(fixture.scorekeeperId, [Role.User]);
    const { matchId, version } = await liveMatch();
    await scorePoint(keeperToken, matchId, 'us', 2);
    const current = await request(app.getHttpServer())
      .get(base(`/${matchId}`))
      .set('Authorization', `Bearer ${coachToken}`);
    const completed = await transition(
      coachToken,
      matchId,
      'complete',
      current.body.recordVersion,
    );
    const finalized = await request(app.getHttpServer())
      .post(base(`/${matchId}/finalization`))
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ expectedRecordVersion: completed.body.recordVersion });
    expect(finalized.status).toBe(200);
    expect(version).toBeGreaterThan(0);
    return { matchId, version: finalized.body.recordVersion };
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
    competitionId = await seedCompetition();
    await assignRole(fixture.coachId, RbacRole.Coach);
    await assignRole(fixture.teamAdminId, RbacRole.TeamAdmin);
    await assignRole(fixture.memberId, RbacRole.Member);
    await assignRole(fixture.scorekeeperId, RbacRole.Scorekeeper);

    const coachToken = await tokenFor(fixture.coachId, [Role.User]);
    const ruleset = await request(app.getHttpServer())
      .post(`/api/v1/teams/${teamId}/match-rulesets`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({
        rulesetKey: 'wfdf-indoor',
        name: 'Indoor',
        gameTo: 15,
        winBy: 1,
        timeoutsPerTeam: 2,
        timeoutsPerPeriod: 1,
        periods: 2,
      });
    expect(ruleset.status).toBe(201);
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

  it('publishes a versioned ruleset with null caps left null (201)', async () => {
    const token = await tokenFor(fixture.coachId, [Role.User]);
    const response = await request(app.getHttpServer())
      .post(`/api/v1/teams/${teamId}/match-rulesets`)
      .set('Authorization', `Bearer ${token}`)
      .send({ rulesetKey: 'outdoor', name: 'Outdoor', gameTo: 13 });
    expect(response.status).toBe(201);
    expect(response.body.rulesetVersion).toBe(1);
    expect(response.body.hardCap).toBeNull();
    expect(response.body.softCapMinutes).toBeNull();
    expect(response.body.timeCapMinutes).toBeNull();
    expect(response.body.halftimeAt).toBeNull();
  });

  it('forbids a member from publishing a ruleset (403 permissionDenied)', async () => {
    const token = await tokenFor(fixture.memberId, [Role.User]);
    const response = await request(app.getHttpServer())
      .post(`/api/v1/teams/${teamId}/match-rulesets`)
      .set('Authorization', `Bearer ${token}`)
      .send({ rulesetKey: 'beach', name: 'Beach', gameTo: 13 });
    expect(response.status).toBe(403);
    expect(response.body.messageKey).toBe('errors.auth.permissionDenied');
  });

  it('lets a coach create a match for a fixture (201, match.manage)', async () => {
    const token = await tokenFor(fixture.coachId, [Role.User]);
    const response = await createMatch(token);
    expect(response.status).toBe(201);
    expect(response.body.status).toBe('scheduled');
    expect(response.body.ourScore).toBe(0);
    expect(response.body.streamVersion).toBe(0);
    expect(response.body.result).toBe('undecided');
    expect(response.body.engineVersion).toBe('match-scoring-v1');
  });

  it('forbids a member from creating a match (403 permissionDenied)', async () => {
    const token = await tokenFor(fixture.memberId, [Role.User]);
    const response = await createMatch(token);
    expect(response.status).toBe(403);
    expect(response.body.messageKey).toBe('errors.auth.permissionDenied');
  });

  it('rejects the match list without a token (401 tokenRequired)', async () => {
    const response = await request(app.getHttpServer()).get(base(''));
    expect(response.status).toBe(401);
    expect(response.body.messageKey).toBe('errors.auth.tokenRequired');
  });

  it('lets a member read the match list (200, match.read)', async () => {
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
      .post(`/api/v1/teams/${otherTeamId}/matches`)
      .set('Authorization', `Bearer ${token}`)
      .send({ fixtureId: randomUUID() });
    expect(response.status).toBe(403);
    expect(response.body.messageKey).toBe('errors.auth.permissionDenied');
  });

  it('hides another team’s match from a scoped reader (404 matchNotFound)', async () => {
    const coachToken = await tokenFor(fixture.coachId, [Role.User]);
    const created = await createMatch(coachToken);
    const token = await tokenFor(fixture.adminId, [Role.Admin]);
    const response = await request(app.getHttpServer())
      .get(`/api/v1/teams/${otherTeamId}/matches/${created.body.matchId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(404);
    expect(response.body.messageKey).toBe('errors.matches.matchNotFound');
  });

  it('hides a fixture from another team behind a not-found scope (404)', async () => {
    const token = await tokenFor(fixture.coachId, [Role.User]);
    const response = await request(app.getHttpServer())
      .post(base(''))
      .set('Authorization', `Bearer ${token}`)
      .send({ fixtureId: randomUUID() });
    expect(response.status).toBe(404);
    expect(response.body.messageKey).toBe('errors.matches.scopeNotFound');
  });

  it('rejects an unreachable transition (409 matchInvalidTransition)', async () => {
    const token = await tokenFor(fixture.coachId, [Role.User]);
    const created = await createMatch(token);
    const response = await transition(
      token,
      created.body.matchId,
      'start',
      created.body.recordVersion,
    );
    expect(response.status).toBe(409);
    expect(response.body.messageKey).toBe(
      'errors.matches.matchInvalidTransition',
    );
  });

  it('rejects a stale optimistic version (409 matchVersionConflict)', async () => {
    const token = await tokenFor(fixture.coachId, [Role.User]);
    const created = await createMatch(token);
    const response = await transition(
      token,
      created.body.matchId,
      'ready',
      Number(created.body.recordVersion) + 99,
    );
    expect(response.status).toBe(409);
    expect(response.body.messageKey).toBe(
      'errors.matches.matchVersionConflict',
    );
  });

  it('requires a reason to abandon a match (400 validation.failed)', async () => {
    const token = await tokenFor(fixture.coachId, [Role.User]);
    const { matchId, version } = await liveMatch();
    const response = await transition(token, matchId, 'abandon', version);
    expect(response.status).toBe(400);
    expect(response.body.messageKey).toBe('errors.matches.validation');
  });

  it('lets a scorekeeper record a point (201, match.score)', async () => {
    const token = await tokenFor(fixture.scorekeeperId, [Role.User]);
    const { matchId } = await liveMatch();
    const response = await scorePoint(token, matchId);
    expect(response.status).toBe(201);
    expect(response.body.outcome).toBe('applied');
    expect(response.body.ourScore).toBe(1);
    expect(response.body.opponentScore).toBe(0);
    expect(response.body.streamVersion).toBe(1);
    expect(response.body.event.eventType).toBe('point');
    expect(response.body.event.voided).toBe(false);
  });

  it('forbids a member from scoring (403 permissionDenied)', async () => {
    const token = await tokenFor(fixture.memberId, [Role.User]);
    const { matchId } = await liveMatch();
    const response = await scorePoint(token, matchId);
    expect(response.status).toBe(403);
    expect(response.body.messageKey).toBe('errors.auth.permissionDenied');
  });

  it('replays the same operation id to one score change (201 replayed)', async () => {
    const token = await tokenFor(fixture.scorekeeperId, [Role.User]);
    const { matchId } = await liveMatch();
    const payload = {
      operationId: operationId(),
      scoringSide: 'us',
      points: 1,
    };
    const first = await request(app.getHttpServer())
      .post(base(`/${matchId}/events/point`))
      .set('Authorization', `Bearer ${token}`)
      .send(payload);
    const replay = await request(app.getHttpServer())
      .post(base(`/${matchId}/events/point`))
      .set('Authorization', `Bearer ${token}`)
      .send(payload);
    expect(first.body.outcome).toBe('applied');
    expect(replay.status).toBe(201);
    expect(replay.body.outcome).toBe('replayed');
    expect(replay.body.event.eventId).toBe(first.body.event.eventId);
    expect(replay.body.ourScore).toBe(1);
    const feed = await request(app.getHttpServer())
      .get(base(`/${matchId}/events`))
      .set('Authorization', `Bearer ${token}`);
    expect(feed.body.total).toBe(1);
  });

  it('rejects the same operation id with a different payload (409)', async () => {
    const token = await tokenFor(fixture.scorekeeperId, [Role.User]);
    const { matchId } = await liveMatch();
    const id = operationId();
    await request(app.getHttpServer())
      .post(base(`/${matchId}/events/point`))
      .set('Authorization', `Bearer ${token}`)
      .send({ operationId: id, scoringSide: 'us', points: 1 });
    const response = await request(app.getHttpServer())
      .post(base(`/${matchId}/events/point`))
      .set('Authorization', `Bearer ${token}`)
      .send({ operationId: id, scoringSide: 'them', points: 1 });
    expect(response.status).toBe(409);
    expect(response.body.messageKey).toBe('errors.matches.operationConflict');
  });

  it('rejects a stale base stream version (409 matchVersionConflict)', async () => {
    const token = await tokenFor(fixture.scorekeeperId, [Role.User]);
    const { matchId } = await liveMatch();
    await scorePoint(token, matchId);
    const response = await request(app.getHttpServer())
      .post(base(`/${matchId}/events/point`))
      .set('Authorization', `Bearer ${token}`)
      .send({
        operationId: operationId(),
        scoringSide: 'us',
        expectedStreamVersion: 0,
      });
    expect(response.status).toBe(409);
    expect(response.body.messageKey).toBe(
      'errors.matches.matchVersionConflict',
    );
  });

  it('rejects a malformed operation id (400 validation.failed)', async () => {
    const token = await tokenFor(fixture.scorekeeperId, [Role.User]);
    const { matchId } = await liveMatch();
    const response = await request(app.getHttpServer())
      .post(base(`/${matchId}/events/point`))
      .set('Authorization', `Bearer ${token}`)
      .send({ operationId: 'short', scoringSide: 'us' });
    expect(response.status).toBe(400);
    expect(response.body.messageKey).toBe('errors.validation.failed');
  });

  it('enforces the versioned timeout allowance (409 timeoutsExhausted)', async () => {
    const token = await tokenFor(fixture.scorekeeperId, [Role.User]);
    const { matchId } = await liveMatch();
    const first = await request(app.getHttpServer())
      .post(base(`/${matchId}/events/timeout`))
      .set('Authorization', `Bearer ${token}`)
      .send({ operationId: operationId(), scoringSide: 'us' });
    expect(first.status).toBe(201);
    const second = await request(app.getHttpServer())
      .post(base(`/${matchId}/events/timeout`))
      .set('Authorization', `Bearer ${token}`)
      .send({ operationId: operationId(), scoringSide: 'us' });
    expect(second.status).toBe(409);
    expect(second.body.messageKey).toBe('errors.matches.timeoutsExhausted');
  });

  it('projects the live scoreboard citing the versioned rules (200)', async () => {
    const keeperToken = await tokenFor(fixture.scorekeeperId, [Role.User]);
    const memberToken = await tokenFor(fixture.memberId, [Role.User]);
    const { matchId } = await liveMatch();
    await scorePoint(keeperToken, matchId, 'us', 2);
    const response = await request(app.getHttpServer())
      .get(base(`/${matchId}/scoreboard`))
      .set('Authorization', `Bearer ${memberToken}`);
    expect(response.status).toBe(200);
    expect(response.body.ourScore).toBe(2);
    expect(response.body.target).toBe(15);
    expect(response.body.capApplied).toBe('none');
    expect(response.body.complete).toBe(false);
    expect(response.body.rulesetKey).toBe('wfdf-indoor');
    expect(response.body.rulesetVersion).toBe(1);
    expect(response.body.engineVersion).toBe('match-scoring-v1');
    expect(response.body.scoringOpen).toBe(true);
    expect(response.body.timeouts.remainingForUs).toBe(1);
  });

  it('undoes a point by appending a void, keeping the original (201)', async () => {
    const token = await tokenFor(fixture.scorekeeperId, [Role.User]);
    const { matchId } = await liveMatch();
    const scored = await scorePoint(token, matchId);
    const response = await request(app.getHttpServer())
      .post(base(`/${matchId}/events/void`))
      .set('Authorization', `Bearer ${token}`)
      .send({
        operationId: operationId(),
        eventId: scored.body.event.eventId,
        reason: 'credited to the wrong side',
      });
    expect(response.status).toBe(201);
    expect(response.body.ourScore).toBe(0);
    const feed = await request(app.getHttpServer())
      .get(base(`/${matchId}/events`))
      .set('Authorization', `Bearer ${token}`);
    expect(feed.body.total).toBe(2);
    const original = feed.body.items.find(
      (item: { eventId: string }) => item.eventId === scored.body.event.eventId,
    );
    expect(original.voided).toBe(true);
    expect(original.points).toBe(1);
  });

  it('forbids a scorekeeper from finalizing a match (403, elevated)', async () => {
    const coachToken = await tokenFor(fixture.coachId, [Role.User]);
    const keeperToken = await tokenFor(fixture.scorekeeperId, [Role.User]);
    const { matchId } = await liveMatch();
    await scorePoint(keeperToken, matchId, 'us', 2);
    const current = await request(app.getHttpServer())
      .get(base(`/${matchId}`))
      .set('Authorization', `Bearer ${coachToken}`);
    const completed = await transition(
      coachToken,
      matchId,
      'complete',
      current.body.recordVersion,
    );
    const response = await request(app.getHttpServer())
      .post(base(`/${matchId}/finalization`))
      .set('Authorization', `Bearer ${keeperToken}`)
      .send({ expectedRecordVersion: completed.body.recordVersion });
    expect(response.status).toBe(403);
    expect(response.body.messageKey).toBe('errors.auth.permissionDenied');
  });

  it('lets a team admin finalize a completed match (200, match.finalize)', async () => {
    const { matchId } = await finalizedMatch();
    const token = await tokenFor(fixture.memberId, [Role.User]);
    const response = await request(app.getHttpServer())
      .get(base(`/${matchId}`))
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('finalized');
    expect(response.body.result).toBe('win');
    expect(response.body.finalizedBy).toBe(fixture.teamAdminId);
  });

  it('never merges a conflicting asserted final score (409)', async () => {
    const coachToken = await tokenFor(fixture.coachId, [Role.User]);
    const adminToken = await tokenFor(fixture.teamAdminId, [Role.User]);
    const keeperToken = await tokenFor(fixture.scorekeeperId, [Role.User]);
    const { matchId } = await liveMatch();
    await scorePoint(keeperToken, matchId, 'us', 2);
    const current = await request(app.getHttpServer())
      .get(base(`/${matchId}`))
      .set('Authorization', `Bearer ${coachToken}`);
    const completed = await transition(
      coachToken,
      matchId,
      'complete',
      current.body.recordVersion,
    );
    const response = await request(app.getHttpServer())
      .post(base(`/${matchId}/finalization`))
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        expectedRecordVersion: completed.body.recordVersion,
        ourScore: 3,
        opponentScore: 0,
      });
    expect(response.status).toBe(409);
    expect(response.body.messageKey).toBe('errors.matches.operationConflict');
  });

  it('refuses to edit a finalized match (409 matchFinalized)', async () => {
    const coachToken = await tokenFor(fixture.coachId, [Role.User]);
    const keeperToken = await tokenFor(fixture.scorekeeperId, [Role.User]);
    const { matchId, version } = await finalizedMatch();
    const transitioned = await transition(
      coachToken,
      matchId,
      'start',
      version,
    );
    expect(transitioned.status).toBe(409);
    expect(transitioned.body.messageKey).toBe('errors.matches.matchFinalized');
    const scored = await scorePoint(keeperToken, matchId);
    expect(scored.status).toBe(409);
    expect(scored.body.messageKey).toBe('errors.matches.matchFinalized');
  });

  it('forbids a coach from reopening a finalized match (403, needs match.correct)', async () => {
    const token = await tokenFor(fixture.coachId, [Role.User]);
    const { matchId, version } = await finalizedMatch();
    const response = await request(app.getHttpServer())
      .post(base(`/${matchId}/reopening`))
      .set('Authorization', `Bearer ${token}`)
      .send({
        reason: 'the second point was credited to the wrong side',
        expectedRecordVersion: version,
      });
    expect(response.status).toBe(403);
    expect(response.body.messageKey).toBe('errors.auth.permissionDenied');
  });

  it('rejects a reopen with no reason (400 validation.failed)', async () => {
    const token = await tokenFor(fixture.teamAdminId, [Role.User]);
    const { matchId, version } = await finalizedMatch();
    const response = await request(app.getHttpServer())
      .post(base(`/${matchId}/reopening`))
      .set('Authorization', `Bearer ${token}`)
      .send({ expectedRecordVersion: version });
    expect(response.status).toBe(400);
    expect(response.body.messageKey).toBe('errors.validation.failed');
  });

  it('reopens a finalized match with a reason and records the trail (200)', async () => {
    const adminToken = await tokenFor(fixture.teamAdminId, [Role.User]);
    const { matchId, version } = await finalizedMatch();
    const response = await request(app.getHttpServer())
      .post(base(`/${matchId}/reopening`))
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        reason: 'the second point was credited to the wrong side',
        expectedRecordVersion: version,
      });
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('live');
    expect(response.body.revision).toBe(2);
    expect(response.body.result).toBe('undecided');
    expect(response.body.finalizedAt).toBeNull();
    expect(response.body.reopenReason).toBe(
      'the second point was credited to the wrong side',
    );
    const trail = await request(app.getHttpServer())
      .get(base(`/${matchId}/revisions`))
      .set('Authorization', `Bearer ${adminToken}`);
    expect(trail.status).toBe(200);
    expect(
      trail.body.items.map((item: { action: string }) => item.action),
    ).toEqual(['finalized', 'reopened']);
    expect(trail.body.items[1].ourScoreBefore).toBe(2);
  });

  it('refuses to reopen a match that was never finalized (409)', async () => {
    const token = await tokenFor(fixture.teamAdminId, [Role.User]);
    const { matchId, version } = await liveMatch();
    const response = await request(app.getHttpServer())
      .post(base(`/${matchId}/reopening`))
      .set('Authorization', `Bearer ${token}`)
      .send({
        reason: 'far too early to correct',
        expectedRecordVersion: version,
      });
    expect(response.status).toBe(409);
    expect(response.body.messageKey).toBe('errors.matches.reopenNotAllowed');
  });

  it('republishes a corrected result after an audited reopen (200)', async () => {
    const coachToken = await tokenFor(fixture.coachId, [Role.User]);
    const adminToken = await tokenFor(fixture.teamAdminId, [Role.User]);
    const keeperToken = await tokenFor(fixture.scorekeeperId, [Role.User]);
    const { matchId, version } = await finalizedMatch();
    const reopened = await request(app.getHttpServer())
      .post(base(`/${matchId}/reopening`))
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        reason: 'the opponent scored three unrecorded points',
        expectedRecordVersion: version,
      });
    expect(reopened.status).toBe(200);
    const corrected = await scorePoint(keeperToken, matchId, 'them', 3);
    expect(corrected.status).toBe(201);
    const current = await request(app.getHttpServer())
      .get(base(`/${matchId}`))
      .set('Authorization', `Bearer ${coachToken}`);
    const completed = await transition(
      coachToken,
      matchId,
      'complete',
      current.body.recordVersion,
    );
    const republished = await request(app.getHttpServer())
      .post(base(`/${matchId}/finalization`))
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ expectedRecordVersion: completed.body.recordVersion });
    expect(republished.status).toBe(200);
    expect(republished.body.result).toBe('loss');
    const trail = await request(app.getHttpServer())
      .get(base(`/${matchId}/revisions`))
      .set('Authorization', `Bearer ${adminToken}`);
    expect(
      trail.body.items.map((item: { action: string }) => item.action),
    ).toEqual(['finalized', 'reopened', 'corrected']);
    expect(trail.body.items[2].opponentScoreAfter).toBe(3);
  });

  it('rejects a malformed match id (400 invalid uuid)', async () => {
    const token = await tokenFor(fixture.coachId, [Role.User]);
    const response = await request(app.getHttpServer())
      .get(base('/not-a-uuid'))
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(400);
  });
});
