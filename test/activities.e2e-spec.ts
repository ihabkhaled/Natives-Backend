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
];

const SECRET_REFERENCE = 'private/evidence/REVIEWER-ONLY-KEY';

interface Fixture {
  readonly dataSource: DataSource;
  readonly adminId: string;
  readonly coachId: string;
  readonly playerId: string;
  readonly buddyId: string;
  readonly strangerId: string;
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
      playerId: await seedUser(dataSource, Role.User),
      buddyId: await seedUser(dataSource, Role.User),
      strangerId: await seedUser(dataSource, Role.User),
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
  ? 'External training (catalog + submissions + evidence + buddies) authorization matrix (e2e, PostgreSQL)'
  : `Activities (e2e) (SKIPPED: test database unreachable at ${TEST_DB_HOST}:${TEST_DB_PORT})`;

describeIfDb(suiteTitle, () => {
  if (!seeded) {
    return;
  }
  const fixture: Fixture = seeded;
  let app: NestFastifyApplication;
  let teamId: string;
  let gymTypeId: string;
  let buddyMembershipId: string;
  const otherTeamId = randomUUID();

  async function tokenFor(userId: string): Promise<string> {
    const port = app.get<AuthTokenPort>(AUTH_TOKEN_PORT);
    return port.sign({ userId, email: 'e@example.test', roles: [Role.User] });
  }

  async function adminTokenFor(userId: string): Promise<string> {
    const port = app.get<AuthTokenPort>(AUTH_TOKEN_PORT);
    return port.sign({ userId, email: 'a@example.test', roles: [Role.Admin] });
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

  function base(path: string): string {
    return `/api/v1/teams/${teamId}/activity-submissions${path}`;
  }

  function submit(path: string, token: string, body: unknown): request.Test {
    return request(app.getHttpServer())
      .post(base(path))
      .set('Authorization', `Bearer ${token}`)
      .send(body as object);
  }

  function draftBody(performedOn: string): Record<string, unknown> {
    return {
      activityTypeId: gymTypeId,
      performedOn,
      durationMinutes: 60,
      notes: 'evening session',
      evidence: [{ kind: 'link', storageReference: SECRET_REFERENCE }],
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

    const adminToken = await adminTokenFor(fixture.adminId);
    const created = await request(app.getHttpServer())
      .post('/api/v1/teams')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ slug: `natives-${randomUUID().slice(0, 8)}`, name: 'Natives' });
    teamId = created.body.id;
    await seedMembership(fixture.playerId);
    buddyMembershipId = await seedMembership(fixture.buddyId);
    await assignCoach(fixture.coachId);
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

  it('exposes the seeded catalog with a pending WFDF point value', async () => {
    const token = await tokenFor(fixture.playerId);
    const response = await request(app.getHttpServer())
      .get(`/api/v1/teams/${teamId}/activity-types`)
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
    const wfdf = response.body.items.find(
      (item: { typeKey: string }) => item.typeKey === 'wfdf_accreditation',
    );
    expect(wfdf.defaultPointValue).toBeNull();
    expect(wfdf.pointsApproval).toBe('pending');
    const gym = response.body.items.find(
      (item: { typeKey: string }) => item.typeKey === 'gym',
    );
    expect(gym.defaultPointValue).toBe(2);
  });

  it('lets a member submit, resubmit after changes, and withdraw their own claim', async () => {
    const token = await tokenFor(fixture.playerId);

    const created = await submit('', token, draftBody('2024-01-15'));
    expect(created.status).toBe(201);
    expect(created.body.submission.status).toBe('draft');
    expect(created.body.buddies).toEqual([]);
    expect(created.body.evidenceCount).toBe(1);
    // The member view never carries the private evidence reference.
    expect(JSON.stringify(created.body)).not.toContain(SECRET_REFERENCE);
    const id = created.body.submission.id;

    const submitted = await submit(`/${id}/submit`, token, {
      expectedRecordVersion: created.body.submission.recordVersion,
    });
    expect(submitted.status).toBe(200);
    expect(submitted.body.submission.status).toBe('submitted');
    expect(await outboxTypes(id)).toContain(
      'activities.submission.submitted.v1',
    );

    // A reviewer sends it back for changes (prompt 401 surface simulated in-db).
    await fixture.dataSource.query(
      `UPDATE "activity_submissions"
          SET "status" = 'changes_requested', "record_version" = "record_version" + 1
        WHERE "id" = $1`,
      [id],
    );
    const current = await request(app.getHttpServer())
      .get(base(`/${id}`))
      .set('Authorization', `Bearer ${token}`);
    expect(current.body.submission.status).toBe('changes_requested');

    const resubmitted = await submit(`/${id}/submit`, token, {
      expectedRecordVersion: current.body.submission.recordVersion,
    });
    expect(resubmitted.status).toBe(200);
    expect(resubmitted.body.submission.status).toBe('submitted');

    const withdrawn = await submit(`/${id}/withdraw`, token, {
      expectedRecordVersion: resubmitted.body.submission.recordVersion,
    });
    expect(withdrawn.status).toBe(200);
    expect(withdrawn.body.submission.status).toBe('withdrawn');
    expect(await outboxTypes(id)).toContain(
      'activities.submission.withdrawn.v1',
    );
  });

  it('hides evidence from a plain member but shows it to a reviewer', async () => {
    const playerToken = await tokenFor(fixture.playerId);
    const coachToken = await tokenFor(fixture.coachId);
    const created = await submit('', playerToken, draftBody('2024-02-15'));
    const id = created.body.submission.id;

    // The owner (a plain member) lacks evidence.read.review → 403.
    const memberView = await request(app.getHttpServer())
      .get(base(`/${id}/evidence`))
      .set('Authorization', `Bearer ${playerToken}`);
    expect(memberView.status).toBe(403);
    expect(memberView.body.messageKey).toBe('errors.auth.permissionDenied');

    // The reviewer sees the private reference.
    const reviewerView = await request(app.getHttpServer())
      .get(base(`/${id}/evidence`))
      .set('Authorization', `Bearer ${coachToken}`);
    expect(reviewerView.status).toBe(200);
    expect(reviewerView.body.items[0].storageReference).toBe(SECRET_REFERENCE);
  });

  it('credits a buddy who must confirm their own participation', async () => {
    const playerToken = await tokenFor(fixture.playerId);
    const buddyToken = await tokenFor(fixture.buddyId);
    const created = await submit('', playerToken, {
      ...draftBody('2024-03-15'),
      buddyMembershipIds: [buddyMembershipId],
    });
    expect(created.status).toBe(201);
    expect(created.body.buddies[0].membershipId).toBe(buddyMembershipId);
    expect(created.body.buddies[0].status).toBe('pending');

    const pending = await request(app.getHttpServer())
      .get(`/api/v1/teams/${teamId}/my-activity-buddies`)
      .set('Authorization', `Bearer ${buddyToken}`);
    expect(pending.status).toBe(200);
    expect(pending.body.total).toBe(1);
    const buddyLinkId = pending.body.items[0].id;

    const confirmed = await request(app.getHttpServer())
      .post(
        `/api/v1/teams/${teamId}/my-activity-buddies/${buddyLinkId}/confirm`,
      )
      .set('Authorization', `Bearer ${buddyToken}`)
      .send({});
    expect(confirmed.status).toBe(200);
    expect(confirmed.body.status).toBe('confirmed');
  });

  it('rejects a member with no membership in the team (404)', async () => {
    const token = await tokenFor(fixture.strangerId);
    const response = await submit('', token, draftBody('2024-04-15'));
    expect(response.status).toBe(404);
    expect(response.body.messageKey).toBe('errors.activities.scopeNotFound');
  });

  it('rejects an invalid workflow transition (409)', async () => {
    const token = await tokenFor(fixture.playerId);
    const created = await submit('', token, draftBody('2024-05-15'));
    const id = created.body.submission.id;
    const first = await submit(`/${id}/submit`, token, {
      expectedRecordVersion: created.body.submission.recordVersion,
    });
    expect(first.status).toBe(200);
    const again = await submit(`/${id}/submit`, token, {
      expectedRecordVersion: first.body.submission.recordVersion,
    });
    expect(again.status).toBe(409);
    expect(again.body.messageKey).toBe('errors.activities.invalidTransition');
  });

  it('denies a scoped reviewer reading evidence in another team (403)', async () => {
    const coachToken = await tokenFor(fixture.coachId);
    const response = await request(app.getHttpServer())
      .get(
        `/api/v1/teams/${otherTeamId}/activity-submissions/${randomUUID()}/evidence`,
      )
      .set('Authorization', `Bearer ${coachToken}`);
    expect(response.status).toBe(403);
    expect(response.body.messageKey).toBe('errors.auth.permissionDenied');
  });

  it('requires authentication for the member self read (401)', async () => {
    const response = await request(app.getHttpServer()).get(
      `/api/v1/teams/${teamId}/activity-submissions`,
    );
    expect(response.status).toBe(401);
    expect(response.body.messageKey).toBe('errors.auth.tokenRequired');
  });
});
