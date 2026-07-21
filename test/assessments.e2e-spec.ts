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
  PlatformLifecycleSchema1723800000000,
];

interface Fixture {
  readonly dataSource: DataSource;
  readonly adminId: string;
  readonly memberId: string;
  readonly coachUserId: string;
  readonly suspendedAdminId: string;
  readonly categoryId: string;
  readonly scaleId: string;
  readonly seededMetricId: string;
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
    const scale = await dataSource.query(
      `SELECT "id" FROM "assessment_scales" WHERE "scale_key" = 'legacy_0_5'`,
    );
    const metric = await dataSource.query(
      `SELECT "id" FROM "assessment_metric_definitions"
        WHERE "definition_key" = 'handling' AND "team_id" IS NULL`,
    );
    return {
      dataSource,
      adminId: await seedUser(dataSource, 'active', Role.Admin),
      memberId: await seedUser(dataSource, 'active', Role.User),
      coachUserId: await seedUser(dataSource, 'active', Role.User),
      suspendedAdminId: await seedUser(dataSource, 'suspended', Role.Admin),
      categoryId: category[0].id,
      scaleId: scale[0].id,
      seededMetricId: metric[0].id,
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
  ? 'Assessment catalog authorization matrix (e2e, PostgreSQL)'
  : `Assessments (e2e) (SKIPPED: test database unreachable at ${TEST_DB_HOST}:${TEST_DB_PORT} — start docker-compose.test.yml)`;

function snakeKey(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/gu, '').slice(0, 12)}`;
}

describeIfDb(suiteTitle, () => {
  if (!seeded) {
    return;
  }
  const fixture: Fixture = seeded;
  let app: NestFastifyApplication;
  let teamId: string;
  const otherTeamId = randomUUID();

  function metricBody(
    overrides: Record<string, unknown> = {},
  ): Record<string, unknown> {
    return {
      key: snakeKey('metric'),
      categoryId: fixture.categoryId,
      scaleId: fixture.scaleId,
      name: 'Team speed',
      definition: 'Observed acceleration quality.',
      direction: 'higher_is_better',
      guidance: 'Use games; null when not observed.',
      applicability: ['player'],
      tags: ['physical'],
      ...overrides,
    };
  }

  function templateBody(
    overrides: Record<string, unknown> = {},
  ): Record<string, unknown> {
    return {
      key: snakeKey('template'),
      name: 'Midseason review',
      evaluatorRoles: [RbacRole.Coach],
      scoreVersion: 1,
      categoryWeights: [
        { categoryId: fixture.categoryId, weightPercentage: 100 },
      ],
      metrics: [
        {
          metricDefinitionId: fixture.seededMetricId,
          required: true,
          sortOrder: 0,
        },
      ],
      ...overrides,
    };
  }

  async function tokenFor(userId: string, roles: Role[]): Promise<string> {
    const tokenPort = app.get<AuthTokenPort>(AUTH_TOKEN_PORT);
    return tokenPort.sign({ userId, email: 'e@example.test', roles });
  }

  async function assignCoach(userId: string, scopeTeam: string): Promise<void> {
    const role = await fixture.dataSource.query(
      `SELECT "id" FROM "roles" WHERE "key" = $1`,
      [RbacRole.Coach],
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

  function post(path: string, token: string, body: unknown): request.Test {
    return request(app.getHttpServer())
      .post(`/api/v1/teams/${teamId}/assessment-catalog${path}`)
      .set('Authorization', `Bearer ${token}`)
      .send(body as object);
  }

  function get(path: string, token: string): request.Test {
    return request(app.getHttpServer())
      .get(`/api/v1/teams/${teamId}/assessment-catalog${path}`)
      .set('Authorization', `Bearer ${token}`);
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
    await assignCoach(fixture.coachUserId, teamId);
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

  it('lets a system admin create a metric definition (version 1)', async () => {
    const token = await tokenFor(fixture.adminId, [Role.Admin]);
    const response = await post('/metrics', token, metricBody());
    expect(response.status).toBe(201);
    expect(response.body.version).toBe(1);
    expect(response.body.recordVersion).toBe(1);
  });

  it('forbids a plain member from creating a metric (403)', async () => {
    const token = await tokenFor(fixture.memberId, [Role.User]);
    const response = await post('/metrics', token, metricBody());
    expect(response.status).toBe(403);
    expect(response.body.messageKey).toBe('errors.auth.permissionDenied');
  });

  it('denies a suspended admin every protected write (403)', async () => {
    const token = await tokenFor(fixture.suspendedAdminId, [Role.Admin]);
    const response = await post('/metrics', token, metricBody());
    expect(response.status).toBe(403);
    expect(response.body.messageKey).toBe('errors.auth.permissionDenied');
  });

  it('requires authentication for catalog reads (401)', async () => {
    const response = await request(app.getHttpServer()).get(
      `/api/v1/teams/${teamId}/assessment-catalog/categories`,
    );
    expect(response.status).toBe(401);
    expect(response.body.messageKey).toBe('errors.auth.tokenRequired');
  });

  it('lets a scoped coach manage their team but denies another (403)', async () => {
    const token = await tokenFor(fixture.coachUserId, [Role.User]);
    const allowed = await post('/metrics', token, metricBody());
    expect(allowed.status).toBe(201);

    const denied = await request(app.getHttpServer())
      .post(`/api/v1/teams/${otherTeamId}/assessment-catalog/metrics`)
      .set('Authorization', `Bearer ${token}`)
      .send(metricBody());
    expect(denied.status).toBe(403);
    expect(denied.body.messageKey).toBe('errors.auth.permissionDenied');
  });

  it('forbids a plain member from reading the team catalog (403)', async () => {
    const token = await tokenFor(fixture.memberId, [Role.User]);
    const response = await get('/categories', token);
    expect(response.status).toBe(403);
    expect(response.body.messageKey).toBe('errors.auth.permissionDenied');
  });

  it('lets a coach read categories, scales, and metrics', async () => {
    const token = await tokenFor(fixture.coachUserId, [Role.User]);
    const categories = await get('/categories', token);
    expect(categories.status).toBe(200);
    expect(categories.body.total).toBeGreaterThanOrEqual(7);

    const scales = await get('/scales', token);
    expect(scales.status).toBe(200);
    const legacy = scales.body.items.find(
      (item: { key: string }) => item.key === 'legacy_0_5',
    );
    expect(legacy.minimumValue).toBe(0);
    expect(legacy.maximumValue).toBe(5);

    const metrics = await get('/metrics', token);
    expect(metrics.status).toBe(200);
    expect(Array.isArray(metrics.body.items)).toBe(true);
  });

  it('rejects an invalid metric body (400 validation.failed)', async () => {
    const token = await tokenFor(fixture.adminId, [Role.Admin]);
    const response = await post('/metrics', token, metricBody({ name: '' }));
    expect(response.status).toBe(400);
    expect(response.body.messageKey).toBe('errors.validation.failed');
  });

  it('rejects an unknown category reference (400 assessments.validation)', async () => {
    const token = await tokenFor(fixture.adminId, [Role.Admin]);
    const response = await post(
      '/metrics',
      token,
      metricBody({ categoryId: randomUUID() }),
    );
    expect(response.status).toBe(400);
    expect(response.body.messageKey).toBe('errors.assessments.validation');
  });

  it('rejects a duplicate metric key (409 duplicate)', async () => {
    const token = await tokenFor(fixture.adminId, [Role.Admin]);
    const body = metricBody({ key: snakeKey('dupe') });
    const first = await post('/metrics', token, body);
    expect(first.status).toBe(201);
    const second = await post('/metrics', token, body);
    expect(second.status).toBe(409);
    expect(second.body.messageKey).toBe('errors.assessments.duplicate');
  });

  it('versions a metric and blocks archiving one bound to a template (409)', async () => {
    const token = await tokenFor(fixture.adminId, [Role.Admin]);
    const created = await post('/metrics', token, metricBody());
    const metricId = created.body.id;

    const version = await post(`/metrics/${metricId}/versions`, token, {
      ...metricBody({ key: created.body.key }),
    });
    expect(version.status).toBe(201);
    expect(version.body.version).toBe(2);

    const template = await post(
      '/templates',
      token,
      templateBody({
        metrics: [
          { metricDefinitionId: version.body.id, required: true, sortOrder: 0 },
        ],
      }),
    );
    expect(template.status).toBe(201);

    const archived = await post(`/metrics/${version.body.id}/archive`, token, {
      expectedRecordVersion: 1,
    });
    expect(archived.status).toBe(409);
    expect(archived.body.messageKey).toBe('errors.assessments.metricInUse');
  });

  it('rejects a version of a metric in the wrong team scope (404)', async () => {
    const token = await tokenFor(fixture.adminId, [Role.Admin]);
    const response = await post(
      `/metrics/${randomUUID()}/versions`,
      token,
      metricBody(),
    );
    expect(response.status).toBe(404);
    expect(response.body.messageKey).toBe('errors.assessments.metricNotFound');
  });

  it('rejects a malformed metric id (400 invalidUuid)', async () => {
    const token = await tokenFor(fixture.adminId, [Role.Admin]);
    const response = await post('/metrics/not-a-uuid/archive', token, {
      expectedRecordVersion: 1,
    });
    expect(response.status).toBe(400);
    expect(response.body.messageKey).toBe('errors.validation.invalidUuid');
  });

  it('rejects template weights that do not total 100 (400)', async () => {
    const token = await tokenFor(fixture.adminId, [Role.Admin]);
    const response = await post(
      '/templates',
      token,
      templateBody({
        categoryWeights: [
          { categoryId: fixture.categoryId, weightPercentage: 60 },
        ],
      }),
    );
    expect(response.status).toBe(400);
    expect(response.body.messageKey).toBe('errors.assessments.validation');
  });

  it('drives a template through create, publish, lock, and period', async () => {
    const token = await tokenFor(fixture.adminId, [Role.Admin]);
    const created = await post('/templates', token, templateBody());
    expect(created.status).toBe(201);
    expect(created.body.status).toBe('draft');
    expect(created.body.categoryWeights).toHaveLength(1);
    const templateId = created.body.id;

    const staleDraft = await post(`/templates/${templateId}/publish`, token, {
      expectedRecordVersion: 99,
    });
    expect(staleDraft.status).toBe(409);
    expect(staleDraft.body.messageKey).toBe(
      'errors.assessments.versionConflict',
    );

    const published = await post(`/templates/${templateId}/publish`, token, {
      expectedRecordVersion: created.body.recordVersion,
    });
    expect(published.status).toBe(200);
    expect(published.body.status).toBe('published');

    const locked = await post(`/templates/${templateId}/publish`, token, {
      expectedRecordVersion: published.body.recordVersion,
    });
    expect(locked.status).toBe(409);
    expect(locked.body.messageKey).toBe('errors.assessments.templateLocked');

    const period = await post('/periods', token, {
      templateId,
      name: 'Q1 review window',
      startsOn: '2026-01-01',
      endsOn: '2026-03-31',
    });
    expect(period.status).toBe(201);
    expect(period.body.startsOn).toBe('2026-01-01');
  });

  it('rejects a period against a draft (unpublished) template (404)', async () => {
    const token = await tokenFor(fixture.adminId, [Role.Admin]);
    const draft = await post('/templates', token, templateBody());
    const response = await post('/periods', token, {
      templateId: draft.body.id,
      name: 'Bad window',
      startsOn: '2026-01-01',
      endsOn: '2026-03-31',
    });
    expect(response.status).toBe(404);
    expect(response.body.messageKey).toBe(
      'errors.assessments.templateNotFound',
    );
  });
});
