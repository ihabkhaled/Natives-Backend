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
import { PlatformLifecycleSchema1723800000000 } from '../src/database/migrations/1723800000000-platform-lifecycle-schema';
import { TeamStaffAssignments1725700000000 } from '../src/database/migrations/1725700000000-team-staff-assignments';
import { TeamPublicProfile1725900000000 } from '../src/database/migrations/1725900000000-team-public-profile';

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
  PlatformLifecycleSchema1723800000000,
  TeamStaffAssignments1725700000000,
  TeamPublicProfile1725900000000,
];

interface Fixture {
  readonly dataSource: DataSource;
  readonly teamAdminUserId: string;
  readonly memberUserId: string;
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
      teamAdminUserId: await seedUser(dataSource, Role.User),
      memberUserId: await seedUser(dataSource, Role.User),
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
  ? 'Staff directory + public team directory (e2e, PostgreSQL)'
  : `Staff directory (e2e) (SKIPPED: test database unreachable at ${TEST_DB_HOST}:${TEST_DB_PORT} — start docker-compose.test.yml)`;

describeIfDb(suiteTitle, () => {
  if (!seeded) {
    return;
  }
  const fixture: Fixture = seeded;
  let app: NestFastifyApplication;
  let teamId: string;
  let teamSlug: string;
  let coachMembershipId: string;
  let titleEntryId: string;

  function api() {
    return request(app.getHttpServer());
  }

  async function tokenFor(userId: string): Promise<string> {
    const tokenPort = app.get<AuthTokenPort>(AUTH_TOKEN_PORT);
    return tokenPort.sign({
      userId,
      email: 'e@example.test',
      roles: [Role.User],
    });
  }

  async function assignTeamAdmin(userId: string): Promise<void> {
    const role = await fixture.dataSource.query(
      `SELECT "id" FROM "roles" WHERE "key" = $1`,
      [RbacRole.TeamAdmin],
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

  beforeAll(async () => {
    process.env['DATABASE_URL'] = TEST_DB_URL;
    app = await createApp();
    await configureSecurity(app);
    await configureValidation(app);
    configureLifecycle(app);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    teamSlug = `staff-directory-${randomUUID().slice(0, 8)}`;
    const teamRows = await fixture.dataSource.query(
      `INSERT INTO "teams" ("slug", "name", "location", "founded_on",
              "facebook_url", "instagram_url", "tiktok_url")
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING "id"`,
      [
        teamSlug,
        'Staff Directory Test Team',
        'El Sheikh Zayed, Giza, Egypt',
        '2021-10-01',
        'https://www.facebook.com/ultimatenatives',
        'https://www.instagram.com/ultimatenatives',
        'https://www.tiktok.com/@ultimate.natives',
      ],
    );
    teamId = teamRows[0].id;

    await assignTeamAdmin(fixture.teamAdminUserId);

    const membershipRows = await fixture.dataSource.query(
      `INSERT INTO "memberships" ("team_id", "user_id", "status",
              "status_effective_at", "joined_at")
       VALUES ($1, $2, 'active', now(), now()) RETURNING "id"`,
      [teamId, fixture.teamAdminUserId],
    );
    coachMembershipId = membershipRows[0].id;
    await fixture.dataSource.query(
      `INSERT INTO "member_profiles" ("membership_id", "team_id", "full_name",
              "nickname", "jersey_number")
       VALUES ($1, $2, $3, $4, $5)`,
      [coachMembershipId, teamId, 'Sherif Ashraf', '3alamy', 33],
    );

    const entryRows = await fixture.dataSource.query(
      `INSERT INTO "reference_catalog_entries" ("team_id", "catalog", "key", "label")
       VALUES ($1, 'staff_title', 'coach', 'Coach') RETURNING "id"`,
      [teamId],
    );
    titleEntryId = entryRows[0].id;
  });

  afterAll(async () => {
    await app.close();
    // This suite is the only one that used to migrate the shared natives_test
    // database and then walk away. The two migrations no other suite lists —
    // team-staff-assignments and team-public-profile — stayed applied, so the
    // next suite to revert by count hit a migration it could not name ("No
    // migration TeamPublicProfile1725900000000 was found in the source code"),
    // and rbac.integration counted the permissions the leftovers had seeded.
    // Leave the database as it was found, like every sibling suite does.
    if (seededDataSource) {
      let remaining = MIGRATIONS.length;
      while (remaining > 0) {
        await seededDataSource.undoLastMigration();
        remaining -= 1;
      }
      await seededDataSource.destroy();
    }
    if (ORIGINAL_DATABASE_URL === undefined) {
      Reflect.deleteProperty(process.env, 'DATABASE_URL');
    } else {
      process.env['DATABASE_URL'] = ORIGINAL_DATABASE_URL;
    }
  });

  describe('staff assignment authorization matrix', () => {
    it('lets a team admin assign a staff title', async () => {
      const token = await tokenFor(fixture.teamAdminUserId);
      const response = await api()
        .post(`/api/v1/teams/${teamId}/staff`)
        .set('Authorization', `Bearer ${token}`)
        .send({ membershipId: coachMembershipId, titleEntryId });

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        membershipId: coachMembershipId,
        titleEntryId,
        status: 'active',
      });
    });

    it('rejects an unaffiliated member from assigning a staff title', async () => {
      const token = await tokenFor(fixture.memberUserId);
      const response = await api()
        .post(`/api/v1/teams/${teamId}/staff`)
        .set('Authorization', `Bearer ${token}`)
        .send({ membershipId: coachMembershipId, titleEntryId });

      expect(response.status).toBe(403);
    });

    it('rejects a duplicate active assignment of the same title', async () => {
      const token = await tokenFor(fixture.teamAdminUserId);
      const response = await api()
        .post(`/api/v1/teams/${teamId}/staff`)
        .set('Authorization', `Bearer ${token}`)
        .send({ membershipId: coachMembershipId, titleEntryId });

      expect(response.status).toBe(409);
    });

    it('lists the team staff assignments', async () => {
      const token = await tokenFor(fixture.teamAdminUserId);
      const response = await api()
        .get(`/api/v1/teams/${teamId}/staff`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.total).toBeGreaterThanOrEqual(1);
    });
  });

  describe('public team directory', () => {
    it('returns the team profile, staff, and active roster without auth', async () => {
      const response = await api().get(
        `/api/v1/public/teams/${teamSlug}/directory`,
      );

      expect(response.status).toBe(200);
      expect(response.body.profile).toMatchObject({
        slug: teamSlug,
        name: 'Staff Directory Test Team',
        location: 'El Sheikh Zayed, Giza, Egypt',
        foundedOn: '2021-10-01',
      });
      expect(response.body.staff).toEqual([
        {
          membershipId: coachMembershipId,
          displayName: 'Sherif Ashraf',
          nickname: '3alamy',
          titles: ['Coach'],
          photoUrl: null,
        },
      ]);
      expect(response.body.players).toEqual([
        {
          membershipId: coachMembershipId,
          displayName: 'Sherif Ashraf',
          nickname: '3alamy',
          jerseyNumber: 33,
          positions: [],
          photoUrl: null,
        },
      ]);
    });

    it('returns 404 for an unknown slug', async () => {
      const response = await api().get(
        '/api/v1/public/teams/ghost-team/directory',
      );
      expect(response.status).toBe(404);
    });
  });
});
