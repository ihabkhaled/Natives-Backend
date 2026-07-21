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
  PlatformLifecycleSchema1723800000000,
];

const SECRET_NOTE = 'PRIVATE-COACH-NOTE-never-leak';

interface Fixture {
  readonly dataSource: DataSource;
  readonly adminId: string;
  readonly coachId: string;
  readonly playerId: string;
  readonly otherPlayerId: string;
  readonly memberId: string;
  readonly suspendedAdminId: string;
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
      coachId: await seedUser(dataSource, 'active', Role.User),
      playerId: await seedUser(dataSource, 'active', Role.User),
      otherPlayerId: await seedUser(dataSource, 'active', Role.User),
      memberId: await seedUser(dataSource, 'active', Role.User),
      suspendedAdminId: await seedUser(dataSource, 'suspended', Role.Admin),
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
  ? 'Development (coach feedback + goals) authorization matrix (e2e, PostgreSQL)'
  : `Development (e2e) (SKIPPED: test database unreachable at ${TEST_DB_HOST}:${TEST_DB_PORT})`;

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

  async function assignCoach(userId: string): Promise<void> {
    const role = await fixture.dataSource.query(
      `SELECT "id" FROM "roles" WHERE "key" = $1`,
      [RbacRole.Coach],
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

  function fb(path: string): string {
    return `/api/v1/teams/${teamId}/coach-feedback${path}`;
  }

  function post(path: string, token: string, body: unknown): request.Test {
    return request(app.getHttpServer())
      .post(fb(path))
      .set('Authorization', `Bearer ${token}`)
      .send(body as object);
  }

  function feedbackBody(membershipId: string): Record<string, unknown> {
    return {
      membershipId,
      fields: {
        positiveFrisbee: 'great hucks',
        summary: 'solid season',
        coachNote: SECRET_NOTE,
      },
    };
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

    const adminToken = await tokenFor(fixture.adminId, [Role.Admin]);
    const created = await request(app.getHttpServer())
      .post('/api/v1/teams')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ slug: `natives-${randomUUID().slice(0, 8)}`, name: 'Natives' });
    teamId = created.body.id;
    await assignCoach(fixture.coachId);
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

  it('drives the feedback lifecycle and keeps the coach note private', async () => {
    const coachToken = await tokenFor(fixture.coachId, [Role.User]);
    const adminToken = await tokenFor(fixture.adminId, [Role.Admin]);
    const playerToken = await tokenFor(fixture.playerId, [Role.User]);
    const membershipId = await seedMembership(fixture.playerId);

    const created = await post('', coachToken, feedbackBody(membershipId));
    expect(created.status).toBe(201);
    expect(created.body.feedback.status).toBe('draft');
    const id = created.body.feedback.id;

    // Private draft never appears in the player's shared list.
    const beforePublish = await request(app.getHttpServer())
      .get(`/api/v1/teams/${teamId}/my-feedback`)
      .set('Authorization', `Bearer ${playerToken}`);
    expect(beforePublish.status).toBe(200);
    expect(beforePublish.body.total).toBe(0);

    const updated = await request(app.getHttpServer())
      .put(fb(`/${id}/fields`))
      .set('Authorization', `Bearer ${coachToken}`)
      .send({
        expectedRecordVersion: created.body.feedback.recordVersion,
        fields: { positiveFrisbee: 'great hucks', coachNote: SECRET_NOTE },
      });
    expect(updated.status).toBe(200);
    expect(updated.body.feedback.recordVersion).toBe(2);

    const submitted = await post(`/${id}/submit`, coachToken, {
      expectedRecordVersion: updated.body.feedback.recordVersion,
    });
    expect(submitted.status).toBe(200);
    expect(submitted.body.feedback.status).toBe('in_review');

    const published = await post(`/${id}/publish`, coachToken, {
      expectedRecordVersion: submitted.body.feedback.recordVersion,
    });
    expect(published.status).toBe(200);
    expect(published.body.feedback.status).toBe('published');
    expect(await outboxTypes(id)).toContain(
      'development.feedback.published.v1',
    );

    // The player now sees the shared feedback WITHOUT the coach note.
    const own = await request(app.getHttpServer())
      .get(`/api/v1/teams/${teamId}/my-feedback`)
      .set('Authorization', `Bearer ${playerToken}`);
    expect(own.status).toBe(200);
    expect(own.body.total).toBe(1);
    expect(own.body.items[0].positiveFrisbee).toBe('great hucks');
    expect(JSON.stringify(own.body.items[0])).not.toContain('coachNote');
    expect(JSON.stringify(own.body)).not.toContain(SECRET_NOTE);

    // Player acknowledges with a clarification request.
    const ack = await request(app.getHttpServer())
      .post(`/api/v1/teams/${teamId}/my-feedback/${id}/acknowledge`)
      .set('Authorization', `Bearer ${playerToken}`)
      .send({
        clarificationRequested: true,
        clarificationNote: 'please expand',
      });
    expect(ack.status).toBe(200);
    expect(ack.body.clarificationRequested).toBe(true);
    expect(await outboxTypes(id)).toContain(
      'development.feedback.clarificationRequested.v1',
    );

    // A second acknowledgement is rejected.
    const twice = await request(app.getHttpServer())
      .post(`/api/v1/teams/${teamId}/my-feedback/${id}/acknowledge`)
      .set('Authorization', `Bearer ${playerToken}`)
      .send({ clarificationRequested: false });
    expect(twice.status).toBe(409);
    expect(twice.body.messageKey).toBe(
      'errors.development.feedbackAlreadyAcknowledged',
    );

    // Correct into a new revision.
    const corrected = await post(`/${id}/correct`, adminToken, {
      reason: 'fixed a typo',
      fields: { summary: 'revised summary', coachNote: 'new secret' },
    });
    expect(corrected.status).toBe(201);
    expect(corrected.body.feedback.status).toBe('revised');
    expect(corrected.body.feedback.revision).toBe(2);
    expect(await outboxTypes(corrected.body.feedback.id)).toContain(
      'development.feedback.revised.v1',
    );

    const revisions = await request(app.getHttpServer())
      .get(fb(`/${id}/revisions`))
      .set('Authorization', `Bearer ${adminToken}`);
    expect(revisions.status).toBe(200);
    expect(revisions.body.items).toHaveLength(2);
    // The revision history is note-free.
    expect(JSON.stringify(revisions.body)).not.toContain(SECRET_NOTE);
  });

  it('forbids a plain member from managing feedback (403)', async () => {
    const token = await tokenFor(fixture.memberId, [Role.User]);
    const membershipId = await seedMembership(
      await seedUser(fixture.dataSource, 'active', Role.User),
    );
    const response = await post('', token, feedbackBody(membershipId));
    expect(response.status).toBe(403);
    expect(response.body.messageKey).toBe('errors.auth.permissionDenied');
  });

  it('denies a suspended admin every protected write (403)', async () => {
    const token = await tokenFor(fixture.suspendedAdminId, [Role.Admin]);
    const membershipId = await seedMembership(
      await seedUser(fixture.dataSource, 'active', Role.User),
    );
    const response = await post('', token, feedbackBody(membershipId));
    expect(response.status).toBe(403);
    expect(response.body.messageKey).toBe('errors.auth.permissionDenied');
  });

  it('requires authentication for the member self read (401)', async () => {
    const response = await request(app.getHttpServer()).get(
      `/api/v1/teams/${teamId}/my-feedback`,
    );
    expect(response.status).toBe(401);
    expect(response.body.messageKey).toBe('errors.auth.tokenRequired');
  });

  it('denies a scoped coach acting in another team (403)', async () => {
    const token = await tokenFor(fixture.coachId, [Role.User]);
    const response = await request(app.getHttpServer())
      .post(`/api/v1/teams/${otherTeamId}/coach-feedback`)
      .set('Authorization', `Bearer ${token}`)
      .send(feedbackBody(randomUUID()));
    expect(response.status).toBe(403);
    expect(response.body.messageKey).toBe('errors.auth.permissionDenied');
  });

  it('rejects publishing a draft as an invalid transition (409)', async () => {
    const coachToken = await tokenFor(fixture.coachId, [Role.User]);
    const membershipId = await seedMembership(
      await seedUser(fixture.dataSource, 'active', Role.User),
    );
    const created = await post('', coachToken, feedbackBody(membershipId));
    const response = await post(
      `/${created.body.feedback.id}/publish`,
      coachToken,
      { expectedRecordVersion: created.body.feedback.recordVersion },
    );
    expect(response.status).toBe(409);
    expect(response.body.messageKey).toBe(
      'errors.development.feedbackInvalidTransition',
    );
  });

  it('hides feedback not shared with a different player on acknowledge (404)', async () => {
    const coachToken = await tokenFor(fixture.coachId, [Role.User]);
    const otherToken = await tokenFor(fixture.otherPlayerId, [Role.User]);
    const membershipId = await seedMembership(
      await seedUser(fixture.dataSource, 'active', Role.User),
    );
    const created = await post('', coachToken, feedbackBody(membershipId));
    const id = created.body.feedback.id;
    await post(`/${id}/submit`, coachToken, {
      expectedRecordVersion: created.body.feedback.recordVersion,
    });
    await post(`/${id}/publish`, coachToken, { expectedRecordVersion: 2 });
    const response = await request(app.getHttpServer())
      .post(`/api/v1/teams/${teamId}/my-feedback/${id}/acknowledge`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ clarificationRequested: false });
    expect(response.status).toBe(404);
    expect(response.body.messageKey).toBe(
      'errors.development.feedbackNotFound',
    );
  });

  it('drives goals and reminders and lets the member see only their own goals', async () => {
    const coachToken = await tokenFor(fixture.coachId, [Role.User]);
    const playerToken = await tokenFor(fixture.playerId, [Role.User]);
    const membershipId = await seedMembership(
      await seedUser(fixture.dataSource, 'active', Role.User),
    );

    const created = await request(app.getHttpServer())
      .post(`/api/v1/teams/${teamId}/development-goals`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({
        membershipId,
        title: 'Raise completion rate',
        measurableTarget: 'complete 90% of throws',
        targetValue: 0.9,
        dueDate: '2020-01-01',
        actions: [
          { description: 'attend throwing clinic', sortOrder: 0 },
          { description: 'log 3 sessions weekly', sortOrder: 1 },
        ],
      });
    expect(created.status).toBe(201);
    expect(created.body.goal.status).toBe('proposed');
    expect(created.body.actions).toHaveLength(2);
    const goalId = created.body.goal.id;

    const activated = await request(app.getHttpServer())
      .post(`/api/v1/teams/${teamId}/development-goals/${goalId}/transition`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({
        transition: 'activate',
        expectedRecordVersion: created.body.goal.recordVersion,
      });
    expect(activated.status).toBe(200);
    expect(activated.body.goal.status).toBe('active');

    const badTransition = await request(app.getHttpServer())
      .post(`/api/v1/teams/${teamId}/development-goals/${goalId}/transition`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({
        transition: 'reopen',
        expectedRecordVersion: activated.body.goal.recordVersion,
      });
    expect(badTransition.status).toBe(409);
    expect(badTransition.body.messageKey).toBe(
      'errors.development.goalInvalidTransition',
    );

    // The overdue active goal produces a privacy-safe reminder.
    const reminders = await request(app.getHttpServer())
      .post(`/api/v1/teams/${teamId}/development-reminders`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({});
    expect(reminders.status).toBe(201);
    expect(reminders.body.goalReminders).toBeGreaterThanOrEqual(1);
    expect(await outboxTypes(goalId)).toContain(
      'development.goal.overdueReminder.v1',
    );

    // The player (a different membership) sees none of this coach-owned goal.
    const ownGoals = await request(app.getHttpServer())
      .get(`/api/v1/teams/${teamId}/my-development-goals`)
      .set('Authorization', `Bearer ${playerToken}`);
    expect(ownGoals.status).toBe(200);
    expect(ownGoals.body.total).toBe(0);
  });
});
