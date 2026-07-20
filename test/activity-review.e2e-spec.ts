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
];

interface Fixture {
  readonly dataSource: DataSource;
  readonly adminId: string;
  readonly coachId: string;
  readonly teamAdminId: string;
  readonly playerId: string;
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
      playerId: await seedUser(dataSource, Role.User),
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
  ? 'External activity review moderation authorization matrix (e2e, PostgreSQL)'
  : `Activity review (e2e) (SKIPPED: test database unreachable at ${TEST_DB_HOST}:${TEST_DB_PORT})`;

describeIfDb(suiteTitle, () => {
  if (!seeded) {
    return;
  }
  const fixture: Fixture = seeded;
  let app: NestFastifyApplication;
  let teamId: string;
  let gymTypeId: string;
  let coachMembershipId: string;
  const otherTeamId = randomUUID();

  async function tokenFor(userId: string): Promise<string> {
    const port = app.get<AuthTokenPort>(AUTH_TOKEN_PORT);
    return port.sign({ userId, email: 'e@example.test', roles: [Role.User] });
  }

  async function adminTokenFor(userId: string): Promise<string> {
    const port = app.get<AuthTokenPort>(AUTH_TOKEN_PORT);
    return port.sign({ userId, email: 'a@example.test', roles: [Role.Admin] });
  }

  async function assignRole(userId: string, key: RbacRole): Promise<void> {
    const role = await fixture.dataSource.query(
      `SELECT "id" FROM "roles" WHERE "key" = $1`,
      [key],
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

  function submissionBase(path: string): string {
    return `/api/v1/teams/${teamId}/activity-submissions${path}`;
  }

  function reviewBase(path: string): string {
    return `/api/v1/teams/${teamId}/activity-review${path}`;
  }

  function draftBody(
    performedOn: string,
    buddyMembershipIds: readonly string[] = [],
  ): Record<string, unknown> {
    return {
      activityTypeId: gymTypeId,
      performedOn,
      durationMinutes: 60,
      notes: 'evening session',
      buddyMembershipIds,
    };
  }

  async function createSubmitted(
    token: string,
    performedOn: string,
    buddyMembershipIds: readonly string[] = [],
  ): Promise<{ id: string; version: number }> {
    const created = await request(app.getHttpServer())
      .post(submissionBase(''))
      .set('Authorization', `Bearer ${token}`)
      .send(draftBody(performedOn, buddyMembershipIds));
    const id = created.body.submission.id;
    const submitted = await request(app.getHttpServer())
      .post(submissionBase(`/${id}/submit`))
      .set('Authorization', `Bearer ${token}`)
      .send({ expectedRecordVersion: created.body.submission.recordVersion });
    return { id, version: submitted.body.submission.recordVersion };
  }

  function reviewPost(
    path: string,
    token: string,
    body: unknown,
  ): request.Test {
    return request(app.getHttpServer())
      .post(reviewBase(path))
      .set('Authorization', `Bearer ${token}`)
      .send(body as object);
  }

  async function outboxTypes(aggregateId: string): Promise<string[]> {
    const rows = await fixture.dataSource.query(
      `SELECT "event_type" FROM "outbox_events" WHERE "aggregate_id" = $1
        ORDER BY "occurred_at" ASC`,
      [aggregateId],
    );
    return rows.map((row: { event_type: string }) => row.event_type);
  }

  beforeAll(async () => {
    process.env['DATABASE_URL'] = TEST_DB_URL;
    app = await createApp();
    await configureSecurity(app);
    await configureValidation(app);
    configureLifecycle(app);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    const adminToken = await adminTokenFor(fixture.adminId);
    const created = await request(app.getHttpServer())
      .post('/api/v1/teams')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ slug: `natives-${randomUUID().slice(0, 8)}`, name: 'Natives' });
    teamId = created.body.id;
    await seedMembership(fixture.playerId);
    coachMembershipId = await seedMembership(fixture.coachId);
    await assignRole(fixture.coachId, RbacRole.Coach);
    await assignRole(fixture.teamAdminId, RbacRole.TeamAdmin);
    const typeRow = await fixture.dataSource.query(
      `SELECT "id" FROM "activity_types" WHERE "type_key" = 'gym'`,
    );
    gymTypeId = typeRow[0].id;
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

  it('lets a reviewer approve a submitted claim (200) and emits ActivityApproved', async () => {
    const playerToken = await tokenFor(fixture.playerId);
    const coachToken = await tokenFor(fixture.coachId);
    const submission = await createSubmitted(playerToken, '2024-07-01');

    const approved = await reviewPost(`/${submission.id}/approve`, coachToken, {
      expectedRecordVersion: submission.version,
      reviewNote: 'verified',
    });
    expect(approved.status).toBe(200);
    expect(approved.body.submission.status).toBe('approved');
    expect(approved.body.submission.reviewNote).toBe('verified');
    expect(await outboxTypes(submission.id)).toContain(
      'activities.submission.approved.v1',
    );
  });

  it('denies a plain member without activity.review (403)', async () => {
    const playerToken = await tokenFor(fixture.playerId);
    const submission = await createSubmitted(playerToken, '2024-07-02');
    const response = await reviewPost(
      `/${submission.id}/approve`,
      playerToken,
      { expectedRecordVersion: submission.version },
    );
    expect(response.status).toBe(403);
    expect(response.body.messageKey).toBe('errors.auth.permissionDenied');
  });

  it('forbids a reviewer approving their own claim (self-review 403)', async () => {
    const coachToken = await tokenFor(fixture.coachId);
    const submission = await createSubmitted(coachToken, '2024-07-03');
    const response = await reviewPost(`/${submission.id}/approve`, coachToken, {
      expectedRecordVersion: submission.version,
    });
    expect(response.status).toBe(403);
    expect(response.body.messageKey).toBe('errors.activities.reviewForbidden');
  });

  it('forbids a reviewer who is a credited buddy (buddy-review 403)', async () => {
    const playerToken = await tokenFor(fixture.playerId);
    const coachToken = await tokenFor(fixture.coachId);
    const submission = await createSubmitted(playerToken, '2024-07-04', [
      coachMembershipId,
    ]);
    const response = await reviewPost(`/${submission.id}/approve`, coachToken, {
      expectedRecordVersion: submission.version,
    });
    expect(response.status).toBe(403);
    expect(response.body.messageKey).toBe('errors.activities.reviewForbidden');
  });

  it('denies a scoped reviewer acting in another team (403)', async () => {
    const coachToken = await tokenFor(fixture.coachId);
    const response = await request(app.getHttpServer())
      .get(`/api/v1/teams/${otherTeamId}/activity-review`)
      .set('Authorization', `Bearer ${coachToken}`);
    expect(response.status).toBe(403);
    expect(response.body.messageKey).toBe('errors.auth.permissionDenied');
  });

  it('rejects an invalid workflow transition (409)', async () => {
    const playerToken = await tokenFor(fixture.playerId);
    const coachToken = await tokenFor(fixture.coachId);
    const submission = await createSubmitted(playerToken, '2024-07-05');
    const first = await reviewPost(`/${submission.id}/approve`, coachToken, {
      expectedRecordVersion: submission.version,
    });
    expect(first.status).toBe(200);
    const again = await reviewPost(`/${submission.id}/approve`, coachToken, {
      expectedRecordVersion: first.body.submission.recordVersion,
    });
    expect(again.status).toBe(409);
    expect(again.body.messageKey).toBe('errors.activities.invalidTransition');
  });

  it('requires a reviewer note to reject (400)', async () => {
    const playerToken = await tokenFor(fixture.playerId);
    const coachToken = await tokenFor(fixture.coachId);
    const submission = await createSubmitted(playerToken, '2024-07-06');
    const response = await reviewPost(`/${submission.id}/reject`, coachToken, {
      expectedRecordVersion: submission.version,
    });
    expect(response.status).toBe(400);
    expect(response.body.messageKey).toBe(
      'errors.activities.reviewNoteRequired',
    );
  });

  it('flows changes-requested → resubmit → approve', async () => {
    const playerToken = await tokenFor(fixture.playerId);
    const coachToken = await tokenFor(fixture.coachId);
    const submission = await createSubmitted(playerToken, '2024-07-07');

    const returned = await reviewPost(
      `/${submission.id}/request-changes`,
      coachToken,
      {
        expectedRecordVersion: submission.version,
        reviewNote: 'please attach evidence',
      },
    );
    expect(returned.status).toBe(200);
    expect(returned.body.submission.status).toBe('changes_requested');

    const resubmitted = await request(app.getHttpServer())
      .post(submissionBase(`/${submission.id}/submit`))
      .set('Authorization', `Bearer ${playerToken}`)
      .send({ expectedRecordVersion: returned.body.submission.recordVersion });
    expect(resubmitted.status).toBe(200);
    expect(resubmitted.body.submission.status).toBe('submitted');

    const approved = await reviewPost(`/${submission.id}/approve`, coachToken, {
      expectedRecordVersion: resubmitted.body.submission.recordVersion,
    });
    expect(approved.status).toBe(200);
    expect(approved.body.submission.status).toBe('approved');
  });

  it('surfaces anti-abuse signals on the reviewer detail', async () => {
    const playerToken = await tokenFor(fixture.playerId);
    const coachToken = await tokenFor(fixture.coachId);
    // Two same-day claims for the same member raise a duplicate-day signal.
    const first = await createSubmitted(playerToken, '2024-08-09');
    const running = await fixture.dataSource.query(
      `SELECT "id" FROM "activity_types" WHERE "type_key" = 'running'`,
    );
    await request(app.getHttpServer())
      .post(submissionBase(''))
      .set('Authorization', `Bearer ${playerToken}`)
      .send({
        activityTypeId: running[0].id,
        performedOn: '2024-08-09',
        durationMinutes: 30,
      });
    const detail = await request(app.getHttpServer())
      .get(reviewBase(`/${first.id}`))
      .set('Authorization', `Bearer ${coachToken}`);
    expect(detail.status).toBe(200);
    expect(detail.body.signals).toContain('duplicate_day');
  });

  it('corrects an approved claim via a compensating reversal (200)', async () => {
    const playerToken = await tokenFor(fixture.playerId);
    const coachToken = await tokenFor(fixture.coachId);
    const adminReviewerToken = await tokenFor(fixture.teamAdminId);
    const submission = await createSubmitted(playerToken, '2024-07-08');
    const approved = await reviewPost(`/${submission.id}/approve`, coachToken, {
      expectedRecordVersion: submission.version,
    });
    expect(approved.status).toBe(200);

    const corrected = await reviewPost(
      `/${submission.id}/correct`,
      adminReviewerToken,
      {
        expectedRecordVersion: approved.body.submission.recordVersion,
        reason: 'duplicate of an earlier approved claim',
      },
    );
    expect(corrected.status).toBe(200);
    expect(corrected.body.submission.status).toBe('reversed');
    expect(corrected.body.submission.reversalReason).toBe(
      'duplicate of an earlier approved claim',
    );
    expect(await outboxTypes(submission.id)).toContain(
      'activities.submission.corrected.v1',
    );
  });

  it('requires authentication for the reviewer queue (401)', async () => {
    const response = await request(app.getHttpServer()).get(reviewBase(''));
    expect(response.status).toBe(401);
    expect(response.body.messageKey).toBe('errors.auth.tokenRequired');
  });
});
