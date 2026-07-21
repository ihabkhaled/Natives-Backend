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
  PlatformLifecycleSchema1723800000000,
];

interface Fixture {
  readonly dataSource: DataSource;
  readonly adminId: string;
  readonly coachId: string;
  readonly memberId: string;
  readonly outsiderId: string;
  readonly handlingMetricId: string;
  readonly shortThrowsMetricId: string;
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

async function metricId(dataSource: DataSource, key: string): Promise<string> {
  const rows = await dataSource.query(
    `SELECT "id" FROM "assessment_metric_definitions"
      WHERE "definition_key" = $1 AND "team_id" IS NULL LIMIT 1`,
    [key],
  );
  return rows[0].id;
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
      memberId: await seedUser(dataSource, 'active', Role.User),
      outsiderId: await seedUser(dataSource, 'active', Role.User),
      handlingMetricId: await metricId(dataSource, 'handling'),
      shortThrowsMetricId: await metricId(dataSource, 'short_throws'),
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
  ? 'Scoring authorization matrix (e2e, PostgreSQL)'
  : `Scoring (e2e) (SKIPPED: test database unreachable at ${TEST_DB_HOST}:${TEST_DB_PORT})`;

describeIfDb(suiteTitle, () => {
  if (!seeded) {
    return;
  }
  const fixture: Fixture = seeded;
  let app: NestFastifyApplication;
  let teamId: string;
  let memberMembershipId: string;
  let publishedRuleId: string;
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

  async function seedMembership(userId: string): Promise<string> {
    const id = randomUUID();
    await fixture.dataSource.query(
      `INSERT INTO "memberships" ("id", "team_id", "user_id", "status")
       VALUES ($1, $2, $3, 'active')`,
      [id, teamId, userId],
    );
    return id;
  }

  async function seedPublishedAssessment(membershipId: string): Promise<void> {
    const templateId = randomUUID();
    const periodId = randomUUID();
    const assessmentId = randomUUID();
    await fixture.dataSource.query(
      `INSERT INTO "assessment_templates"
        ("id", "family_id", "team_id", "template_key", "name", "evaluator_roles",
         "score_version", "status", "template_version")
       VALUES ($1, $1, $2, 'default', 'Default', ARRAY['COACH'], 1, 'published', 1)`,
      [templateId, teamId],
    );
    await fixture.dataSource.query(
      `INSERT INTO "assessment_periods"
        ("id", "team_id", "template_id", "name", "starts_on", "ends_on")
       VALUES ($1, $2, $3, 'Q1', '2026-01-01', '2026-03-31')`,
      [periodId, teamId, templateId],
    );
    await fixture.dataSource.query(
      `INSERT INTO "player_assessments"
        ("id", "family_id", "team_id", "period_id", "template_id",
         "membership_id", "evaluator_user_id", "status")
       VALUES ($1, $1, $2, $3, $4, $5, $6, 'published')`,
      [
        assessmentId,
        teamId,
        periodId,
        templateId,
        membershipId,
        fixture.coachId,
      ],
    );
    await fixture.dataSource.query(
      `INSERT INTO "player_assessment_metric_values"
        ("id", "assessment_id", "metric_definition_id", "numeric_value")
       VALUES ($1, $2, $3, 4), ($4, $2, $5, 2)`,
      [
        randomUUID(),
        assessmentId,
        fixture.handlingMetricId,
        randomUUID(),
        fixture.shortThrowsMetricId,
      ],
    );
  }

  function rulesBase(path: string): string {
    return `/api/v1/teams/${teamId}/calculation-rules${path}`;
  }

  function scoresBase(path: string): string {
    return `/api/v1/teams/${teamId}/performance-scores${path}`;
  }

  function draftBody(ruleKey: string): Record<string, unknown> {
    return {
      ruleKey,
      name: 'Team technical overall',
      components: [{ categoryKey: 'technical', weight: 1, minSample: 1 }],
    };
  }

  async function createRule(
    adminToken: string,
    ruleKey: string,
  ): Promise<{ id: string; recordVersion: number }> {
    const created = await request(app.getHttpServer())
      .post(rulesBase(''))
      .set('Authorization', `Bearer ${adminToken}`)
      .send(draftBody(ruleKey));
    return {
      id: created.body.ruleId,
      recordVersion: created.body.recordVersion,
    };
  }

  async function transition(
    adminToken: string,
    ruleId: string,
    verb: string,
    expectedRecordVersion: number,
  ): Promise<number> {
    const response = await request(app.getHttpServer())
      .post(rulesBase(`/${ruleId}/transition`))
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ transition: verb, expectedRecordVersion });
    return response.body.recordVersion;
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
    await assignRole(fixture.coachId, RbacRole.Coach);
    await assignRole(fixture.memberId, RbacRole.Member);
    memberMembershipId = await seedMembership(fixture.memberId);
    await seedPublishedAssessment(memberMembershipId);

    const rule = await createRule(adminToken, 'team_overall');
    const approvedVersion = await transition(
      adminToken,
      rule.id,
      'approve',
      rule.recordVersion,
    );
    await transition(adminToken, rule.id, 'publish', approvedVersion);
    publishedRuleId = rule.id;
    await request(app.getHttpServer())
      .post(scoresBase('/rebuild'))
      .set('Authorization', `Bearer ${adminToken}`)
      .send();
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

  it('lets a member read only their own score, with its explanation (200)', async () => {
    const token = await tokenFor(fixture.memberId, [Role.User]);
    const response = await request(app.getHttpServer())
      .get(`/api/v1/teams/${teamId}/my-performance-score`)
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(response.body.items).toHaveLength(1);
    const score = response.body.items[0];
    expect(score.membershipId).toBe(memberMembershipId);
    expect(score.value).toBe(3); // mean(handling 4, short_throws 2)
    expect(score.explanation.rule.version).toBe(1);
    expect(score.explanation.overall.numerator).toBe(3);
    expect(score.explanation.components.length).toBeGreaterThan(0);
  });

  it('lets a coach read the whole team’s scores (200, analytics.read.team)', async () => {
    const token = await tokenFor(fixture.coachId, [Role.User]);
    const list = await request(app.getHttpServer())
      .get(scoresBase(''))
      .set('Authorization', `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(list.body.total).toBeGreaterThanOrEqual(1);
    const member = await request(app.getHttpServer())
      .get(scoresBase(`/${memberMembershipId}`))
      .set('Authorization', `Bearer ${token}`);
    expect(member.status).toBe(200);
    expect(member.body.items[0].explanation.rule.version).toBe(1);
  });

  it('forbids a member from reading the whole team’s scores (403)', async () => {
    const token = await tokenFor(fixture.memberId, [Role.User]);
    const response = await request(app.getHttpServer())
      .get(scoresBase(''))
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(403);
    expect(response.body.messageKey).toBe('errors.auth.permissionDenied');
  });

  it('forbids a member from managing calculation rules (403)', async () => {
    const token = await tokenFor(fixture.memberId, [Role.User]);
    const response = await request(app.getHttpServer())
      .post(rulesBase(''))
      .set('Authorization', `Bearer ${token}`)
      .send(draftBody('member_rule'));
    expect(response.status).toBe(403);
    expect(response.body.messageKey).toBe('errors.auth.permissionDenied');
  });

  it('forbids a coach from simulating a rule — admin-only (403)', async () => {
    const token = await tokenFor(fixture.coachId, [Role.User]);
    const response = await request(app.getHttpServer())
      .post(rulesBase(`/${publishedRuleId}/simulate`))
      .set('Authorization', `Bearer ${token}`)
      .send({ membershipId: memberMembershipId });
    expect(response.status).toBe(403);
    expect(response.body.messageKey).toBe('errors.auth.permissionDenied');
  });

  it('lets an administrator dry-run a draft rule without writing (200)', async () => {
    const adminToken = await tokenFor(fixture.adminId, [Role.Admin]);
    const draft = await createRule(
      adminToken,
      `sim_${randomUUID().slice(0, 8)}`,
    );
    const response = await request(app.getHttpServer())
      .post(rulesBase(`/${draft.id}/simulate`))
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ membershipId: memberMembershipId });
    expect(response.status).toBe(200);
    expect(response.body.draft.overall.display).toBe(3);
    expect(response.body.published.overall.display).toBe(3);
    expect(response.body.delta).toBe(0);
    const persisted = await fixture.dataSource.query(
      `SELECT COUNT(*)::int AS "count" FROM "performance_score_projections"
        WHERE "rule_id" = $1`,
      [draft.id],
    );
    expect(persisted[0].count).toBe(0); // simulation writes nothing
  });

  it('rejects the self read without a token (401 tokenRequired)', async () => {
    const response = await request(app.getHttpServer()).get(
      `/api/v1/teams/${teamId}/my-performance-score`,
    );
    expect(response.status).toBe(401);
    expect(response.body.messageKey).toBe('errors.auth.tokenRequired');
  });

  it('denies a coach scoped to a different team (403)', async () => {
    const token = await tokenFor(fixture.coachId, [Role.User]);
    const response = await request(app.getHttpServer())
      .get(`/api/v1/teams/${otherTeamId}/performance-scores`)
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(403);
    expect(response.body.messageKey).toBe('errors.auth.permissionDenied');
  });

  it('returns 404 for a member with no projection (scoring.projectionNotFound)', async () => {
    const token = await tokenFor(fixture.coachId, [Role.User]);
    const response = await request(app.getHttpServer())
      .get(scoresBase(`/${randomUUID()}`))
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(404);
    expect(response.body.messageKey).toBe('errors.scoring.projectionNotFound');
  });
});
