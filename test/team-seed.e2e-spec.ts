import { configureLifecycle } from '@app/bootstrap/configure-lifecycle';
import { configureSecurity } from '@app/bootstrap/configure-security';
import { configureValidation } from '@app/bootstrap/configure-validation';
import { createApp } from '@app/bootstrap/create-app';
import { buildDataSourceOptions } from '@app/database/data-source.factory';
import { buildSeeders } from '@app/database/seeds/seed-registry';
import { runSeeders } from '@app/database/seeds/seed-runner';
import type { DatabaseConfig } from '@config/config.types';
import type { AppLogger } from '@core/logger';
import { PasswordHashAdapter } from '@modules/auth/adapters/password-hash.adapter';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { Client } from 'pg';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { BaselineSchema1721200000000 } from '../src/database/migrations/1721200000000-baseline-schema';
import { IdentitySchema1721300000000 } from '../src/database/migrations/1721300000000-identity-schema';
import { RbacSchema1721400000000 } from '../src/database/migrations/1721400000000-rbac-schema';
import { TeamsSchema1721500000000 } from '../src/database/migrations/1721500000000-teams-schema';
import { MembersSchema1721600000000 } from '../src/database/migrations/1721600000000-members-schema';
import { PracticesSchema1721800000000 } from '../src/database/migrations/1721800000000-practices-schema';
import { SeedHistorySchema1722600000000 } from '../src/database/migrations/1722600000000-seed-history-schema';
import { CompetitionsSchema1723300000000 } from '../src/database/migrations/1723300000000-competitions-schema';
import { SquadsSchema1723400000000 } from '../src/database/migrations/1723400000000-squads-schema';
import { RostersSchema1723500000000 } from '../src/database/migrations/1723500000000-rosters-schema';
import { MatchesSchema1723600000000 } from '../src/database/migrations/1723600000000-matches-schema';
import { MatchLineupsSchema1723700000000 } from '../src/database/migrations/1723700000000-match-lineups-schema';
import { PlatformLifecycleSchema1723800000000 } from '../src/database/migrations/1723800000000-platform-lifecycle-schema';
import { RbacRoleCatalogMetadata1725000000000 } from '../src/database/migrations/1725000000000-rbac-role-catalog-metadata';

// Proves the seeded principal contract over real HTTP on a disposable database
// of its own: the once-only seeders are the ONLY writes, so `/auth/me` here is
// exactly what a freshly provisioned deployment returns. The persona seeder's
// v3 demonstration set additionally needs the practices and competition/match
// schemas (squads → rosters in FK dependency order for the matches FKs).
const SEED_MIGRATIONS = [
  BaselineSchema1721200000000,
  IdentitySchema1721300000000,
  RbacSchema1721400000000,
  TeamsSchema1721500000000,
  MembersSchema1721600000000,
  PracticesSchema1721800000000,
  SeedHistorySchema1722600000000,
  CompetitionsSchema1723300000000,
  SquadsSchema1723400000000,
  RostersSchema1723500000000,
  MatchesSchema1723600000000,
  MatchLineupsSchema1723700000000,
  PlatformLifecycleSchema1723800000000,
  RbacRoleCatalogMetadata1725000000000,
];

const HOST = process.env['TEST_DB_HOST'] ?? '127.0.0.1';
const PORT = Number(process.env['TEST_DB_PORT'] ?? '55432');
const USER = process.env['TEST_DB_USERNAME'] ?? 'natives_test';
const PASSWORD = process.env['TEST_DB_PASSWORD'] ?? 'natives_test';
const SEED_DB = 'natives_team_seed_e2e_test';
const MAINTENANCE_DB = 'postgres';
const SEED_DB_URL = `postgres://${USER}:${PASSWORD}@${HOST}:${PORT}/${SEED_DB}`;

const SEED_DB_CONFIG: DatabaseConfig = {
  url: SEED_DB_URL,
  host: HOST,
  port: PORT,
  username: USER,
  password: PASSWORD,
  name: SEED_DB,
  poolMin: 1,
  poolMax: 4,
  connectTimeoutMs: 3000,
  statementTimeoutMs: 10_000,
  ssl: false,
  logging: false,
  migrationsRunOnStart: false,
  seedOnStart: false,
};

const ADMIN_EMAIL = 'seeded-admin@example.test';
const ADMIN_PASSWORD = 'correct-horse-battery-staple';
const PERSONA_PASSWORD = 'persona-horse-battery-staple';
const COACH_EMAIL = 'headcoach@ultimatenatives.local';
const ADMIN_DISPLAY_NAME = 'Seeded Administrator';

function buildLogger(): AppLogger {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    setContext: vi.fn(),
  } as unknown as AppLogger;
}

async function connectMaintenanceOrNull(): Promise<Client | null> {
  const client = new Client({
    host: HOST,
    port: PORT,
    user: USER,
    password: PASSWORD,
    database: MAINTENANCE_DB,
    connectionTimeoutMillis: 3000,
  });
  try {
    await client.connect();
    return client;
  } catch {
    return null;
  }
}

async function provision(client: Client): Promise<DataSource> {
  await client.query(`DROP DATABASE IF EXISTS "${SEED_DB}" WITH (FORCE)`);
  await client.query(`CREATE DATABASE "${SEED_DB}"`);
  const dataSource = new DataSource({
    ...buildDataSourceOptions(SEED_DB_CONFIG),
    migrations: SEED_MIGRATIONS,
  });
  await dataSource.initialize();
  await dataSource.runMigrations();
  await runSeeders(
    dataSource,
    buildSeeders({
      passwordHash: new PasswordHashAdapter(),
      loadAdminConfig: () => ({
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        displayName: ADMIN_DISPLAY_NAME,
      }),
      loadPersonasConfig: () => ({ password: PERSONA_PASSWORD }),
    }),
    buildLogger(),
    'boot',
  );
  return dataSource;
}

const ORIGINAL_DATABASE_URL = process.env['DATABASE_URL'];
const maintenance = await connectMaintenanceOrNull();
const seededDataSource = maintenance ? await provision(maintenance) : null;

const describeIfDb = seededDataSource ? describe : describe.skip;
const suiteTitle = seededDataSource
  ? 'Seeded Ultimate Natives principal (e2e, PostgreSQL)'
  : `Seeded Ultimate Natives principal (e2e) (SKIPPED: test database unreachable at ${HOST}:${PORT} — start docker-compose.test.yml)`;

describeIfDb(suiteTitle, () => {
  const activeDataSource = seededDataSource;
  const client = maintenance;
  if (activeDataSource === null || client === null) {
    return;
  }

  let app: NestFastifyApplication;

  beforeAll(async () => {
    // Sibling e2e suites reset DATABASE_URL in their afterAll, and this suite's
    // app is only created now — re-assert its own disposable database.
    process.env['DATABASE_URL'] = SEED_DB_URL;
    app = await createApp();
    await configureSecurity(app);
    await configureValidation(app);
    configureLifecycle(app);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  }, 60_000);

  afterAll(async () => {
    await app.close();
    await activeDataSource.destroy();
    await client.query(`DROP DATABASE IF EXISTS "${SEED_DB}" WITH (FORCE)`);
    await client.end();
    if (ORIGINAL_DATABASE_URL === undefined) {
      delete process.env['DATABASE_URL'];
    } else {
      process.env['DATABASE_URL'] = ORIGINAL_DATABASE_URL;
    }
  });

  async function login(): Promise<request.Response> {
    return request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  }

  it('POST /auth/login returns the seeded team membership', async () => {
    const response = await login();

    expect(response.status).toBe(200);
    expect(response.body.user.memberships).toEqual([
      expect.objectContaining({
        teamSlug: 'un',
        teamName: 'Ultimate Natives',
        status: 'active',
        roles: ['team_admin'],
      }),
    ]);
  });

  it('GET /auth/me returns the seeded team membership with its current season', async () => {
    const loggedIn = await login();

    const response = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set(
        'Authorization',
        `Bearer ${loggedIn.body.tokens.accessToken as string}`,
      );

    expect(response.status).toBe(200);
    expect(response.body.email).toBe(ADMIN_EMAIL);
    expect(response.body.memberships).toHaveLength(1);
    const membership = response.body.memberships[0];
    expect(membership).toMatchObject({
      teamSlug: 'un',
      teamName: 'Ultimate Natives',
      status: 'active',
      roles: ['team_admin'],
    });
    expect(membership.seasonSlug).toBe(String(new Date().getUTCFullYear()));
    expect(membership.membershipId).toEqual(expect.any(String));
  });

  it('gives the seeded administrator the team-management permissions', async () => {
    const loggedIn = await login();

    const response = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set(
        'Authorization',
        `Bearer ${loggedIn.body.tokens.accessToken as string}`,
      );

    expect(response.body.permissions).toEqual(
      expect.arrayContaining([
        'team.settings.manage',
        'member.invite',
        'member.roles.manage',
      ]),
    );
  });

  async function seededTeamId(): Promise<string> {
    const rows: { id: string }[] = await activeDataSource.query(
      `SELECT "id" FROM "teams" WHERE lower("slug") = 'un'`,
    );
    return rows[0].id;
  }

  async function adminMembershipId(): Promise<string> {
    const rows: { id: string }[] = await activeDataSource.query(
      `SELECT m."id" FROM "memberships" m
        JOIN "users" u ON u."id" = m."user_id"
       WHERE lower(u."email") = lower($1)`,
      [ADMIN_EMAIL],
    );
    return rows[0].id;
  }

  // BUG 1 regression: the seeded TEAM_ADMIN persona — exactly what a fresh
  // deployment logs in as — must be able to assign roles to a member that has a
  // linked account, and must get the SPECIFIC accountRequired reason (not a
  // generic failure) for the accountless membership the owner hit.
  it('lets the seeded admin persona assign a role to an account-backed member', async () => {
    const loggedIn = await login();
    const token = loggedIn.body.tokens.accessToken as string;
    const teamId = await seededTeamId();
    const membershipId = await adminMembershipId();

    const response = await request(app.getHttpServer())
      .put(`/api/v1/teams/${teamId}/members/${membershipId}/roles`)
      .set('Authorization', `Bearer ${token}`)
      .send({ roles: ['team_admin', 'coach'] });

    expect(response.status).toBe(200);
    expect(response.body.membershipId).toBe(membershipId);
    expect(response.body.roles).toEqual(['coach', 'team_admin']);
  });

  it('denies role assignment on an accountless membership with the real reason (409)', async () => {
    const loggedIn = await login();
    const token = loggedIn.body.tokens.accessToken as string;
    const teamId = await seededTeamId();

    const invited = await request(app.getHttpServer())
      .post(`/api/v1/teams/${teamId}/members/invite`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        profile: { fullName: 'Historical Player', email: 'hist@example.test' },
      });
    expect(invited.status).toBe(201);
    const accountlessMembershipId = invited.body.id as string;

    const response = await request(app.getHttpServer())
      .put(`/api/v1/teams/${teamId}/members/${accountlessMembershipId}/roles`)
      .set('Authorization', `Bearer ${token}`)
      .send({ roles: ['coach'] });

    expect(response.status).toBe(409);
    expect(response.body.messageKey).toBe('errors.members.accountRequired');
  });

  it('lets a seeded persona log in with the shared development credential', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: COACH_EMAIL, password: PERSONA_PASSWORD });

    expect(response.status).toBe(200);
    expect(response.body.user.memberships).toEqual([
      expect.objectContaining({ teamSlug: 'un', status: 'active' }),
    ]);
  });

  it('lets the seeded super admin browse teams while a coach cannot', async () => {
    const superAdmin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'superadmin@ultimatenatives.local',
        password: PERSONA_PASSWORD,
      });
    expect(superAdmin.status).toBe(200);

    const browsed = await request(app.getHttpServer())
      .get('/api/v1/teams')
      .set(
        'Authorization',
        `Bearer ${superAdmin.body.tokens.accessToken as string}`,
      );
    expect(browsed.status).toBe(200);
    expect(browsed.body.total).toBeGreaterThan(0);

    const coach = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: COACH_EMAIL, password: PERSONA_PASSWORD });
    const denied = await request(app.getHttpServer())
      .get('/api/v1/teams')
      .set(
        'Authorization',
        `Bearer ${coach.body.tokens.accessToken as string}`,
      );
    expect(denied.status).toBe(403);
    expect(denied.body.messageKey).toBe('errors.auth.permissionDenied');
  });

  // The membership-less invariant (P7 §2.1): a platform role alone must not
  // fabricate team membership. The seeded platform-only super admin logs in
  // with platform authority and an EMPTY membership list.
  it('lets the membership-less super admin log in with zero memberships', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'platformonly@ultimatenatives.local',
        password: PERSONA_PASSWORD,
      });

    expect(response.status).toBe(200);
    expect(response.body.user.memberships).toEqual([]);

    const browsed = await request(app.getHttpServer())
      .get('/api/v1/teams')
      .set(
        'Authorization',
        `Bearer ${response.body.tokens.accessToken as string}`,
      );
    expect(browsed.status).toBe(200);
    expect(browsed.body.total).toBeGreaterThan(0);
  });

  // The v3 demonstration practice program: a fresh database answers the coach
  // with published sessions positioned relative to the seed instant, at least
  // one of which is inside its P3-B1 self check-in window right now.
  it('exposes the seeded practice program to the head coach', async () => {
    const coach = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: COACH_EMAIL, password: PERSONA_PASSWORD });
    const teamId = await seededTeamId();

    const response = await request(app.getHttpServer())
      .get(`/api/v1/teams/${teamId}/practice-sessions`)
      .set(
        'Authorization',
        `Bearer ${coach.body.tokens.accessToken as string}`,
      );

    expect(response.status).toBe(200);
    expect(response.body.total).toBe(5);
    const items = response.body.items as readonly {
      status: string;
      venueId: string | null;
      startsAt: string;
      endsAt: string;
    }[];
    expect(items).toHaveLength(5);
    for (const session of items) {
      expect(session.status).toBe('published');
      expect(session.venueId).not.toBeNull();
    }
    const now = Date.now();
    const checkInAble = items.filter(
      session =>
        new Date(session.startsAt).getTime() - 60 * 60_000 <= now &&
        new Date(session.endsAt).getTime() >= now,
    );
    expect(checkInAble.length).toBeGreaterThanOrEqual(1);
  });

  // The v3 scorekeeper queue: one scheduled match exists on a fresh database,
  // so the scorekeeper journey has something to open without manual set-up.
  it('exposes the seeded scheduled match to the scorekeeper', async () => {
    const scorekeeper = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'scorekeeper@ultimatenatives.local',
        password: PERSONA_PASSWORD,
      });
    const teamId = await seededTeamId();

    const response = await request(app.getHttpServer())
      .get(`/api/v1/teams/${teamId}/matches`)
      .set(
        'Authorization',
        `Bearer ${scorekeeper.body.tokens.accessToken as string}`,
      );

    expect(response.status).toBe(200);
    expect(response.body.total).toBe(1);
    expect(response.body.items[0]).toMatchObject({
      status: 'scheduled',
      ourScore: 0,
      opponentScore: 0,
    });
  });
});
