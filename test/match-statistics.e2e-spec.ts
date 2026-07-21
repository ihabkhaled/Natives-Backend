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
import { MatchLineupsSchema1723700000000 } from '../src/database/migrations/1723700000000-match-lineups-schema';

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
  MatchLineupsSchema1723700000000,
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
  ? 'Match lineups and statistics authorization matrix (e2e, PostgreSQL)'
  : `Match statistics (e2e) (SKIPPED: test database unreachable at ${TEST_DB_HOST}:${TEST_DB_PORT})`;

describeIfDb(suiteTitle, () => {
  if (!seeded) {
    return;
  }
  const fixture: Fixture = seeded;
  let app: NestFastifyApplication;
  let teamId: string;
  let seasonId: string;
  let competitionId: string;
  let memberships: readonly string[] = [];
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

  async function seedMembership(): Promise<string> {
    const userId = randomUUID();
    const membershipId = randomUUID();
    await fixture.dataSource.query(
      `INSERT INTO "users" ("id", "email", "role", "status")
       VALUES ($1, $2, 'user', 'active')`,
      [userId, `player-${userId}@example.test`],
    );
    await fixture.dataSource.query(
      `INSERT INTO "memberships" ("id", "user_id", "team_id", "status")
       VALUES ($1, $2, $3, 'active')`,
      [membershipId, userId, teamId],
    );
    return membershipId;
  }

  async function seedFixtureAndRoster(): Promise<{
    fixtureId: string;
    rosterId: string;
  }> {
    const opponentId = randomUUID();
    const fixtureId = randomUUID();
    const rosterId = randomUUID();
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
    await fixture.dataSource.query(
      `INSERT INTO "rosters" ("id", "team_id", "season_id", "competition_id",
         "fixture_id", "roster_kind", "name", "status")
       VALUES ($1, $2, $3, $4, $5, 'match', 'Match roster', 'draft')`,
      [rosterId, teamId, seasonId, competitionId, fixtureId],
    );
    for (const membershipId of memberships) {
      await fixture.dataSource.query(
        `INSERT INTO "roster_entries" ("id", "roster_id", "team_id",
           "membership_id") VALUES ($1, $2, $3, $4)`,
        [randomUUID(), rosterId, teamId, membershipId],
      );
    }
    return { fixtureId, rosterId };
  }

  function base(path: string): string {
    return `/api/v1/teams/${teamId}/matches${path}`;
  }

  function operationId(): string {
    return `op-${randomUUID()}`;
  }

  async function liveMatch(): Promise<string> {
    const coachToken = await tokenFor(fixture.coachId, [Role.User]);
    const scope = await seedFixtureAndRoster();
    const created = await request(app.getHttpServer())
      .post(base(''))
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ fixtureId: scope.fixtureId, rosterId: scope.rosterId });
    expect(created.status).toBe(201);
    const ready = await request(app.getHttpServer())
      .post(base(`/${created.body.matchId}/transition`))
      .set('Authorization', `Bearer ${coachToken}`)
      .send({
        transition: 'ready',
        expectedRecordVersion: created.body.recordVersion,
      });
    await request(app.getHttpServer())
      .post(base(`/${created.body.matchId}/transition`))
      .set('Authorization', `Bearer ${coachToken}`)
      .send({
        transition: 'start',
        expectedRecordVersion: ready.body.recordVersion,
      });
    return created.body.matchId;
  }

  async function startPoint(
    token: string,
    matchId: string,
    line: readonly string[],
    startingLine = 'offense',
  ): Promise<request.Response> {
    return request(app.getHttpServer())
      .post(base(`/${matchId}/points`))
      .set('Authorization', `Bearer ${token}`)
      .send({
        operationId: operationId(),
        startingLine,
        lineMembershipIds: line,
        pullerMembershipId: line[0],
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

    const seasonId_ = randomUUID();
    await fixture.dataSource.query(
      `INSERT INTO "seasons" ("id", "team_id", "slug", "name", "starts_on",
         "ends_on", "status")
       VALUES ($1, $2, $3, 'Season', '2026-01-01', '2026-12-31', 'active')`,
      [seasonId_, teamId, `s-${seasonId_.slice(0, 8)}`],
    );
    seasonId = seasonId_;
    const competitionId_ = randomUUID();
    await fixture.dataSource.query(
      `INSERT INTO "competitions" ("id", "team_id", "season_id", "name",
         "competition_type", "status")
       VALUES ($1, $2, $3, 'Nationals', 'championship', 'published')`,
      [competitionId_, teamId, seasonId_],
    );
    competitionId = competitionId_;

    await assignRole(fixture.coachId, RbacRole.Coach);
    await assignRole(fixture.teamAdminId, RbacRole.TeamAdmin);
    await assignRole(fixture.memberId, RbacRole.Member);
    await assignRole(fixture.scorekeeperId, RbacRole.Scorekeeper);

    memberships = [
      await seedMembership(),
      await seedMembership(),
      await seedMembership(),
    ];

    const coachToken = await tokenFor(fixture.coachId, [Role.User]);
    const ruleset = await request(app.getHttpServer())
      .post(`/api/v1/teams/${teamId}/match-rulesets`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({
        rulesetKey: 'wfdf-indoor',
        name: 'Indoor',
        gameTo: 15,
        timeoutsPerTeam: 2,
        opponentErrorAttribution: true,
      });
    expect(ruleset.status).toBe(201);
    expect(ruleset.body.opponentErrorAttribution).toBe(true);
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

  it('lets a scorekeeper open a point with a lineup (201, match.score)', async () => {
    const token = await tokenFor(fixture.scorekeeperId, [Role.User]);
    const matchId = await liveMatch();
    const response = await startPoint(token, matchId, memberships.slice(0, 2));
    expect(response.status).toBe(201);
    expect(response.body.outcome).toBe('applied');
    expect(response.body.pointNumber).toBe(1);
    expect(response.body.play.playType).toBe('point_started');
    expect(response.body.play.startingLine).toBe('offense');
    expect(response.body.play.retracted).toBe(false);
    expect(response.body.lineup).toHaveLength(2);
  });

  it('forbids a member from opening a point (403 permissionDenied)', async () => {
    const token = await tokenFor(fixture.memberId, [Role.User]);
    const matchId = await liveMatch();
    const response = await startPoint(token, matchId, memberships.slice(0, 2));
    expect(response.status).toBe(403);
    expect(response.body.messageKey).toBe('errors.auth.permissionDenied');
  });

  it('rejects the point stream without a token (401 tokenRequired)', async () => {
    const matchId = await liveMatch();
    const response = await request(app.getHttpServer()).get(
      base(`/${matchId}/points`),
    );
    expect(response.status).toBe(401);
    expect(response.body.messageKey).toBe('errors.auth.tokenRequired');
  });

  it('denies a scorekeeper scoring for a different team (403)', async () => {
    const token = await tokenFor(fixture.scorekeeperId, [Role.User]);
    const response = await request(app.getHttpServer())
      .post(`/api/v1/teams/${otherTeamId}/matches/${randomUUID()}/points`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        operationId: operationId(),
        startingLine: 'offense',
        lineMembershipIds: memberships.slice(0, 2),
      });
    expect(response.status).toBe(403);
    expect(response.body.messageKey).toBe('errors.auth.permissionDenied');
  });

  it('hides another team’s statistics from a scoped reader (404)', async () => {
    const matchId = await liveMatch();
    const token = await tokenFor(fixture.adminId, [Role.Admin]);
    const response = await request(app.getHttpServer())
      .get(`/api/v1/teams/${otherTeamId}/matches/${matchId}/statistics`)
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(404);
    expect(response.body.messageKey).toBe('errors.matches.matchNotFound');
  });

  it('lets a member read the derived statistics (200, match.stats.read)', async () => {
    const keeperToken = await tokenFor(fixture.scorekeeperId, [Role.User]);
    const memberToken = await tokenFor(fixture.memberId, [Role.User]);
    const matchId = await liveMatch();
    await startPoint(keeperToken, matchId, memberships.slice(0, 2));
    const response = await request(app.getHttpServer())
      .get(base(`/${matchId}/statistics`))
      .set('Authorization', `Bearer ${memberToken}`);
    expect(response.status).toBe(200);
    expect(response.body.statsEngineVersion).toBe('match-statistics-v1');
    expect(response.body.rulesetKey).toBe('wfdf-indoor');
    expect(response.body.rulesetVersion).toBe(1);
    expect(response.body.players).toHaveLength(memberships.length);
  });

  it('records a full point and derives hold, goals, and points played', async () => {
    const token = await tokenFor(fixture.scorekeeperId, [Role.User]);
    const matchId = await liveMatch();
    await startPoint(token, matchId, memberships.slice(0, 2));
    const goal = await request(app.getHttpServer())
      .post(base(`/${matchId}/points/plays`))
      .set('Authorization', `Bearer ${token}`)
      .send({
        operationId: operationId(),
        playType: 'goal',
        primaryMembershipId: memberships[0],
        secondaryMembershipId: memberships[1],
        assistState: 'recorded',
      });
    expect(goal.status).toBe(201);
    const completion = await request(app.getHttpServer())
      .post(base(`/${matchId}/points/completion`))
      .set('Authorization', `Bearer ${token}`)
      .send({ operationId: operationId(), scoringSide: 'us' });
    expect(completion.status).toBe(201);
    const stats = await request(app.getHttpServer())
      .get(base(`/${matchId}/statistics`))
      .set('Authorization', `Bearer ${token}`);
    expect(stats.body.team.holds).toBe(1);
    expect(stats.body.team.goalsFor).toBe(1);
    const scorer = stats.body.players.find(
      (player: { membershipId: string }) =>
        player.membershipId === memberships[0],
    );
    expect(scorer.goals).toBe(1);
    expect(scorer.pointsPlayed).toBe(1);
  });

  it('keeps a zero-stat rostered player present with a measured zero', async () => {
    const token = await tokenFor(fixture.scorekeeperId, [Role.User]);
    const matchId = await liveMatch();
    await startPoint(token, matchId, memberships.slice(0, 2));
    await request(app.getHttpServer())
      .post(base(`/${matchId}/points/plays`))
      .set('Authorization', `Bearer ${token}`)
      .send({
        operationId: operationId(),
        playType: 'goal',
        primaryMembershipId: memberships[0],
        assistState: 'none',
      });
    await request(app.getHttpServer())
      .post(base(`/${matchId}/points/completion`))
      .set('Authorization', `Bearer ${token}`)
      .send({ operationId: operationId(), scoringSide: 'us' });
    const stats = await request(app.getHttpServer())
      .get(base(`/${matchId}/statistics`))
      .set('Authorization', `Bearer ${token}`);
    const benched = stats.body.players.find(
      (player: { membershipId: string }) =>
        player.membershipId === memberships[2],
    );
    expect(benched).toBeDefined();
    expect(benched.rostered).toBe(true);
    expect(benched.pointsPlayed).toBe(0);
    expect(benched.goals).toBe(0);
    expect(benched.blocks).toBe(0);
  });

  it('reports null, not zero, for a match nobody tracked', async () => {
    const token = await tokenFor(fixture.scorekeeperId, [Role.User]);
    const matchId = await liveMatch();
    const stats = await request(app.getHttpServer())
      .get(base(`/${matchId}/statistics`))
      .set('Authorization', `Bearer ${token}`);
    expect(stats.body.lineupsRecorded).toBe(false);
    expect(stats.body.playsRecorded).toBe(false);
    for (const player of stats.body.players) {
      expect(player.pointsPlayed).toBeNull();
      expect(player.goals).toBeNull();
    }
  });

  it('replays the same operation id to exactly one recorded fact (201)', async () => {
    const token = await tokenFor(fixture.scorekeeperId, [Role.User]);
    const matchId = await liveMatch();
    const payload = {
      operationId: operationId(),
      startingLine: 'defense',
      lineMembershipIds: memberships.slice(0, 2),
    };
    const first = await request(app.getHttpServer())
      .post(base(`/${matchId}/points`))
      .set('Authorization', `Bearer ${token}`)
      .send(payload);
    const replay = await request(app.getHttpServer())
      .post(base(`/${matchId}/points`))
      .set('Authorization', `Bearer ${token}`)
      .send(payload);
    expect(first.body.outcome).toBe('applied');
    expect(replay.status).toBe(201);
    expect(replay.body.outcome).toBe('replayed');
    expect(replay.body.play.playId).toBe(first.body.play.playId);
    const feed = await request(app.getHttpServer())
      .get(base(`/${matchId}/points`))
      .set('Authorization', `Bearer ${token}`);
    expect(feed.body.total).toBe(1);
  });

  it('rejects the same operation id with a different payload (409)', async () => {
    const token = await tokenFor(fixture.scorekeeperId, [Role.User]);
    const matchId = await liveMatch();
    const id = operationId();
    await request(app.getHttpServer())
      .post(base(`/${matchId}/points`))
      .set('Authorization', `Bearer ${token}`)
      .send({
        operationId: id,
        startingLine: 'offense',
        lineMembershipIds: memberships.slice(0, 2),
      });
    const response = await request(app.getHttpServer())
      .post(base(`/${matchId}/points`))
      .set('Authorization', `Bearer ${token}`)
      .send({
        operationId: id,
        startingLine: 'defense',
        lineMembershipIds: memberships.slice(0, 2),
      });
    expect(response.status).toBe(409);
    expect(response.body.messageKey).toBe('errors.matches.operationConflict');
  });

  it('refuses a second open point (409 pointAlreadyOpen)', async () => {
    const token = await tokenFor(fixture.scorekeeperId, [Role.User]);
    const matchId = await liveMatch();
    await startPoint(token, matchId, memberships.slice(0, 2));
    const response = await startPoint(token, matchId, memberships.slice(0, 2));
    expect(response.status).toBe(409);
    expect(response.body.messageKey).toBe('errors.matches.pointAlreadyOpen');
  });

  it('refuses a possession fact with no open point (409 pointNotOpen)', async () => {
    const token = await tokenFor(fixture.scorekeeperId, [Role.User]);
    const matchId = await liveMatch();
    const response = await request(app.getHttpServer())
      .post(base(`/${matchId}/points/plays`))
      .set('Authorization', `Bearer ${token}`)
      .send({
        operationId: operationId(),
        playType: 'block',
        primaryMembershipId: memberships[0],
      });
    expect(response.status).toBe(409);
    expect(response.body.messageKey).toBe('errors.matches.pointNotOpen');
  });

  it('rejects a duplicated player on the line (400 lineupInvalid)', async () => {
    const token = await tokenFor(fixture.scorekeeperId, [Role.User]);
    const matchId = await liveMatch();
    const response = await request(app.getHttpServer())
      .post(base(`/${matchId}/points`))
      .set('Authorization', `Bearer ${token}`)
      .send({
        operationId: operationId(),
        startingLine: 'offense',
        lineMembershipIds: [memberships[0], memberships[0]],
      });
    expect(response.status).toBe(400);
    expect(response.body.messageKey).toBe('errors.matches.lineupInvalid');
  });

  it('rejects a malformed operation id (400 validation.failed)', async () => {
    const token = await tokenFor(fixture.scorekeeperId, [Role.User]);
    const matchId = await liveMatch();
    const response = await request(app.getHttpServer())
      .post(base(`/${matchId}/points`))
      .set('Authorization', `Bearer ${token}`)
      .send({
        operationId: 'short',
        startingLine: 'offense',
        lineMembershipIds: memberships.slice(0, 2),
      });
    expect(response.status).toBe(400);
    expect(response.body.messageKey).toBe('errors.validation.failed');
  });

  it('retracts a fact with a correction and rebuilds without it (201)', async () => {
    const token = await tokenFor(fixture.scorekeeperId, [Role.User]);
    const matchId = await liveMatch();
    await startPoint(token, matchId, memberships.slice(0, 2));
    const wrong = await request(app.getHttpServer())
      .post(base(`/${matchId}/points/plays`))
      .set('Authorization', `Bearer ${token}`)
      .send({
        operationId: operationId(),
        playType: 'goal',
        primaryMembershipId: memberships[1],
        assistState: 'none',
      });
    const correction = await request(app.getHttpServer())
      .post(base(`/${matchId}/points/corrections`))
      .set('Authorization', `Bearer ${token}`)
      .send({
        operationId: operationId(),
        playId: wrong.body.play.playId,
        reason: 'credited to the wrong player',
      });
    expect(correction.status).toBe(201);
    await request(app.getHttpServer())
      .post(base(`/${matchId}/points/plays`))
      .set('Authorization', `Bearer ${token}`)
      .send({
        operationId: operationId(),
        playType: 'goal',
        primaryMembershipId: memberships[0],
        assistState: 'none',
      });
    const stats = await request(app.getHttpServer())
      .get(base(`/${matchId}/statistics`))
      .set('Authorization', `Bearer ${token}`);
    const wronglyCredited = stats.body.players.find(
      (player: { membershipId: string }) =>
        player.membershipId === memberships[1],
    );
    const credited = stats.body.players.find(
      (player: { membershipId: string }) =>
        player.membershipId === memberships[0],
    );
    expect(wronglyCredited.goals).toBe(0);
    expect(credited.goals).toBe(1);
    const feed = await request(app.getHttpServer())
      .get(base(`/${matchId}/points`))
      .set('Authorization', `Bearer ${token}`);
    const original = feed.body.items.find(
      (item: { playId: string }) => item.playId === wrong.body.play.playId,
    );
    expect(original.retracted).toBe(true);
  });

  it('rebuilds the projection to exactly the read value (200)', async () => {
    const token = await tokenFor(fixture.scorekeeperId, [Role.User]);
    const matchId = await liveMatch();
    await startPoint(token, matchId, memberships.slice(0, 2), 'defense');
    await request(app.getHttpServer())
      .post(base(`/${matchId}/points/completion`))
      .set('Authorization', `Bearer ${token}`)
      .send({ operationId: operationId(), scoringSide: 'us' });
    const read = await request(app.getHttpServer())
      .get(base(`/${matchId}/statistics`))
      .set('Authorization', `Bearer ${token}`);
    const rebuilt = await request(app.getHttpServer())
      .post(base(`/${matchId}/statistics/rebuild`))
      .set('Authorization', `Bearer ${token}`);
    expect(rebuilt.status).toBe(200);
    expect(rebuilt.body).toEqual(read.body);
    expect(rebuilt.body.team.breaks).toBe(1);
  });

  it('forbids a user without match.stats.read from the projection (403)', async () => {
    const matchId = await liveMatch();
    const tokenPort = app.get<AuthTokenPort>(AUTH_TOKEN_PORT);
    const strangerToken = await tokenPort.sign({
      userId: randomUUID(),
      email: 'stranger@example.test',
      roles: [Role.User],
    });
    const response = await request(app.getHttpServer())
      .get(base(`/${matchId}/statistics`))
      .set('Authorization', `Bearer ${strangerToken}`);
    expect(response.status).toBe(403);
    expect(response.body.messageKey).toBe('errors.auth.permissionDenied');
  });

  it('refuses to append to a finalized match (409 matchFinalized)', async () => {
    const coachToken = await tokenFor(fixture.coachId, [Role.User]);
    const adminToken = await tokenFor(fixture.teamAdminId, [Role.User]);
    const keeperToken = await tokenFor(fixture.scorekeeperId, [Role.User]);
    const matchId = await liveMatch();
    await startPoint(keeperToken, matchId, memberships.slice(0, 2));
    await request(app.getHttpServer())
      .post(base(`/${matchId}/points/completion`))
      .set('Authorization', `Bearer ${keeperToken}`)
      .send({ operationId: operationId(), scoringSide: 'us' });
    const current = await request(app.getHttpServer())
      .get(base(`/${matchId}`))
      .set('Authorization', `Bearer ${coachToken}`);
    const completed = await request(app.getHttpServer())
      .post(base(`/${matchId}/transition`))
      .set('Authorization', `Bearer ${coachToken}`)
      .send({
        transition: 'complete',
        expectedRecordVersion: current.body.recordVersion,
      });
    const finalized = await request(app.getHttpServer())
      .post(base(`/${matchId}/finalization`))
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ expectedRecordVersion: completed.body.recordVersion });
    expect(finalized.status).toBe(200);
    const response = await startPoint(
      keeperToken,
      matchId,
      memberships.slice(0, 2),
    );
    expect(response.status).toBe(409);
    expect(response.body.messageKey).toBe('errors.matches.matchFinalized');
    const stats = await request(app.getHttpServer())
      .get(base(`/${matchId}/statistics`))
      .set('Authorization', `Bearer ${keeperToken}`);
    expect(stats.status).toBe(200);
    expect(stats.body.team.pointsCompleted).toBe(1);
  });

  it('rejects a malformed match id (400 invalid uuid)', async () => {
    const token = await tokenFor(fixture.scorekeeperId, [Role.User]);
    const response = await request(app.getHttpServer())
      .get(base('/not-a-uuid/statistics'))
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(400);
  });
});
