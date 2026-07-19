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
];

interface Fixture {
  readonly dataSource: DataSource;
  readonly adminId: string;
  readonly coachId: string;
  readonly reviewerId: string;
  readonly playerId: string;
  readonly memberId: string;
  readonly suspendedAdminId: string;
  readonly categoryId: string;
  readonly metricId: string;
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
    const category = await dataSource.query(
      `SELECT "id" FROM "assessment_metric_categories" WHERE "category_key" = 'technical'`,
    );
    const metric = await dataSource.query(
      `SELECT "id" FROM "assessment_metric_definitions"
        WHERE "definition_key" = 'handling' AND "team_id" IS NULL`,
    );
    return {
      dataSource,
      adminId: await seedUser(dataSource, 'active', Role.Admin),
      coachId: await seedUser(dataSource, 'active', Role.User),
      reviewerId: await seedUser(dataSource, 'active', Role.User),
      playerId: await seedUser(dataSource, 'active', Role.User),
      memberId: await seedUser(dataSource, 'active', Role.User),
      suspendedAdminId: await seedUser(dataSource, 'suspended', Role.Admin),
      categoryId: category[0].id,
      metricId: metric[0].id,
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
  ? 'Player assessment workflow authorization matrix (e2e, PostgreSQL)'
  : `Player assessments (e2e) (SKIPPED: test database unreachable at ${TEST_DB_HOST}:${TEST_DB_PORT})`;

describeIfDb(suiteTitle, () => {
  if (!seeded) {
    return;
  }
  const fixture: Fixture = seeded;
  let app: NestFastifyApplication;
  let teamId: string;
  let templateId: string;
  let periodId: string;
  const otherTeamId = randomUUID();

  async function tokenFor(userId: string, roles: Role[]): Promise<string> {
    const tokenPort = app.get<AuthTokenPort>(AUTH_TOKEN_PORT);
    return tokenPort.sign({ userId, email: 'e@example.test', roles });
  }

  async function assignRole(
    userId: string,
    roleKey: RbacRole,
    scopeTeam: string,
  ): Promise<void> {
    const role = await fixture.dataSource.query(
      `SELECT "id" FROM "roles" WHERE "key" = $1`,
      [roleKey],
    );
    await fixture.dataSource.query(
      `INSERT INTO "user_role_assignments" ("id", "user_id", "role_id", "team_id")
       VALUES ($1, $2, $3, $4)`,
      [randomUUID(), userId, role[0].id, scopeTeam],
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

  async function freshMembership(): Promise<string> {
    const userId = await seedUser(fixture.dataSource, 'active', Role.User);
    return seedMembership(userId);
  }

  function base(path: string): string {
    return `/api/v1/teams/${teamId}/player-assessments${path}`;
  }

  function post(path: string, token: string, body: unknown): request.Test {
    return request(app.getHttpServer())
      .post(base(path))
      .set('Authorization', `Bearer ${token}`)
      .send(body as object);
  }

  function put(path: string, token: string, body: unknown): request.Test {
    return request(app.getHttpServer())
      .put(base(path))
      .set('Authorization', `Bearer ${token}`)
      .send(body as object);
  }

  function draftBody(membershipId: string): Record<string, unknown> {
    return {
      periodId,
      membershipId,
      summary: 'Strong midseason showing.',
      values: [{ metricDefinitionId: fixture.metricId, numericValue: 4 }],
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

  async function createPublishedTemplate(adminToken: string): Promise<void> {
    const created = await request(app.getHttpServer())
      .post(`/api/v1/teams/${teamId}/assessment-catalog/templates`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        key: `tmpl_${randomUUID().replace(/-/gu, '').slice(0, 10)}`,
        name: 'Midseason review',
        evaluatorRoles: [RbacRole.Coach],
        scoreVersion: 1,
        categoryWeights: [
          { categoryId: fixture.categoryId, weightPercentage: 100 },
        ],
        metrics: [
          {
            metricDefinitionId: fixture.metricId,
            required: true,
            sortOrder: 0,
          },
        ],
      });
    templateId = created.body.id;
    await request(app.getHttpServer())
      .post(
        `/api/v1/teams/${teamId}/assessment-catalog/templates/${templateId}/publish`,
      )
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ expectedRecordVersion: created.body.recordVersion });
    const period = await request(app.getHttpServer())
      .post(`/api/v1/teams/${teamId}/assessment-catalog/periods`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        templateId,
        name: 'Q1 window',
        startsOn: '2026-01-01',
        endsOn: '2026-03-31',
      });
    periodId = period.body.id;
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
    await assignRole(fixture.coachId, RbacRole.Coach, teamId);
    await assignRole(fixture.reviewerId, RbacRole.Coach, teamId);
    await createPublishedTemplate(adminToken);
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

  it('drives the full workflow and lets the player see only their published result', async () => {
    const coachToken = await tokenFor(fixture.coachId, [Role.User]);
    const reviewerToken = await tokenFor(fixture.reviewerId, [Role.User]);
    const adminToken = await tokenFor(fixture.adminId, [Role.Admin]);
    const playerToken = await tokenFor(fixture.playerId, [Role.User]);
    const membershipId = await seedMembership(fixture.playerId);

    const created = await post('', coachToken, draftBody(membershipId));
    expect(created.status).toBe(201);
    expect(created.body.assessment.status).toBe('draft');
    const id = created.body.assessment.id;

    const updated = await put(`/${id}/values`, coachToken, {
      expectedRecordVersion: created.body.assessment.recordVersion,
      summary: 'Strong midseason showing.',
      values: [{ metricDefinitionId: fixture.metricId, numericValue: 4 }],
    });
    expect(updated.status).toBe(200);
    expect(updated.body.assessment.recordVersion).toBe(2);

    const submitted = await post(`/${id}/submit`, coachToken, {
      expectedRecordVersion: updated.body.assessment.recordVersion,
    });
    expect(submitted.status).toBe(200);
    expect(submitted.body.assessment.status).toBe('submitted');
    expect(await outboxTypes(id)).toContain('assessment.submitted.v1');

    const selfApprove = await post(`/${id}/review`, coachToken, {
      decision: 'approve',
      expectedRecordVersion: submitted.body.assessment.recordVersion,
      note: null,
    });
    expect(selfApprove.status).toBe(403);
    expect(selfApprove.body.messageKey).toBe(
      'errors.assessments.selfApprovalForbidden',
    );

    const approved = await post(`/${id}/review`, reviewerToken, {
      decision: 'approve',
      expectedRecordVersion: submitted.body.assessment.recordVersion,
      note: 'looks accurate',
    });
    expect(approved.status).toBe(200);
    expect(approved.body.assessment.status).toBe('approved');

    const published = await post(`/${id}/publish`, adminToken, {
      expectedRecordVersion: approved.body.assessment.recordVersion,
    });
    expect(published.status).toBe(200);
    expect(published.body.assessment.status).toBe('published');
    expect(await outboxTypes(id)).toContain('assessment.published.v1');

    const own = await request(app.getHttpServer())
      .get(`/api/v1/teams/${teamId}/my-assessments`)
      .set('Authorization', `Bearer ${playerToken}`);
    expect(own.status).toBe(200);
    expect(own.body.total).toBe(1);
    expect(own.body.items[0].summary).toBe('Strong midseason showing.');
    expect(JSON.stringify(own.body.items[0])).not.toContain('note');

    const corrected = await post(`/${id}/correct`, adminToken, {
      reason: 'Corrected a keying error',
      summary: 'Revised midseason result.',
      values: [{ metricDefinitionId: fixture.metricId, numericValue: 5 }],
    });
    expect(corrected.status).toBe(201);
    expect(corrected.body.assessment.status).toBe('revised');
    expect(corrected.body.assessment.revision).toBe(2);
    expect(await outboxTypes(corrected.body.assessment.id)).toContain(
      'assessment.revised.v1',
    );

    const revisions = await request(app.getHttpServer())
      .get(base(`/${id}/revisions`))
      .set('Authorization', `Bearer ${adminToken}`);
    expect(revisions.status).toBe(200);
    expect(revisions.body.items).toHaveLength(2);

    const afterCorrection = await request(app.getHttpServer())
      .get(`/api/v1/teams/${teamId}/my-assessments`)
      .set('Authorization', `Bearer ${playerToken}`);
    expect(afterCorrection.body.total).toBe(1);
    expect(afterCorrection.body.items[0].revision).toBe(2);
  });

  it('forbids a plain member from creating an assessment (403)', async () => {
    const token = await tokenFor(fixture.memberId, [Role.User]);
    const membershipId = await freshMembership();
    const response = await post('', token, draftBody(membershipId));
    expect(response.status).toBe(403);
    expect(response.body.messageKey).toBe('errors.auth.permissionDenied');
  });

  it('denies a suspended admin every protected write (403)', async () => {
    const token = await tokenFor(fixture.suspendedAdminId, [Role.Admin]);
    const membershipId = await freshMembership();
    const response = await post('', token, draftBody(membershipId));
    expect(response.status).toBe(403);
    expect(response.body.messageKey).toBe('errors.auth.permissionDenied');
  });

  it('requires authentication for the player self read (401)', async () => {
    const response = await request(app.getHttpServer()).get(
      `/api/v1/teams/${teamId}/my-assessments`,
    );
    expect(response.status).toBe(401);
    expect(response.body.messageKey).toBe('errors.auth.tokenRequired');
  });

  it('denies a scoped coach acting in another team (403)', async () => {
    const token = await tokenFor(fixture.coachId, [Role.User]);
    const response = await request(app.getHttpServer())
      .post(`/api/v1/teams/${otherTeamId}/player-assessments`)
      .set('Authorization', `Bearer ${token}`)
      .send(draftBody(randomUUID()));
    expect(response.status).toBe(403);
    expect(response.body.messageKey).toBe('errors.auth.permissionDenied');
  });

  it('rejects publishing a draft as an invalid transition (409)', async () => {
    const coachToken = await tokenFor(fixture.coachId, [Role.User]);
    const adminToken = await tokenFor(fixture.adminId, [Role.Admin]);
    const membershipId = await freshMembership();
    const created = await post('', coachToken, draftBody(membershipId));
    const response = await post(
      `/${created.body.assessment.id}/publish`,
      adminToken,
      {
        expectedRecordVersion: created.body.assessment.recordVersion,
      },
    );
    expect(response.status).toBe(409);
    expect(response.body.messageKey).toBe(
      'errors.assessments.invalidTransition',
    );
  });

  it('hides another evaluator’s draft on submit as not-found (404)', async () => {
    const coachToken = await tokenFor(fixture.coachId, [Role.User]);
    const reviewerToken = await tokenFor(fixture.reviewerId, [Role.User]);
    const membershipId = await freshMembership();
    const created = await post('', coachToken, draftBody(membershipId));
    const response = await post(
      `/${created.body.assessment.id}/submit`,
      reviewerToken,
      {
        expectedRecordVersion: created.body.assessment.recordVersion,
      },
    );
    expect(response.status).toBe(404);
    expect(response.body.messageKey).toBe(
      'errors.assessments.playerAssessmentNotFound',
    );
  });

  it('rejects an out-of-scale metric value (400 assessments.validation)', async () => {
    const coachToken = await tokenFor(fixture.coachId, [Role.User]);
    const membershipId = await freshMembership();
    const response = await post('', coachToken, {
      ...draftBody(membershipId),
      values: [{ metricDefinitionId: fixture.metricId, numericValue: 99 }],
    });
    expect(response.status).toBe(400);
    expect(response.body.messageKey).toBe('errors.assessments.validation');
  });
});
