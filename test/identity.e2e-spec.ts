import { createHash, randomUUID } from 'node:crypto';

import { configureLifecycle } from '@app/bootstrap/configure-lifecycle';
import { configureSecurity } from '@app/bootstrap/configure-security';
import { configureValidation } from '@app/bootstrap/configure-validation';
import { createApp } from '@app/bootstrap/create-app';
import { buildDataSourceOptions } from '@app/database/data-source.factory';
import type { DatabaseConfig } from '@config/config.types';
import { AUTH_TOKEN_PORT, type AuthTokenPort } from '@core/auth';
import { PasswordHashAdapter } from '@modules/auth/adapters/password-hash.adapter';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { Role } from '@shared/enums';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { BaselineSchema1721200000000 } from '../src/database/migrations/1721200000000-baseline-schema';
import { IdentitySchema1721300000000 } from '../src/database/migrations/1721300000000-identity-schema';
import { RbacSchema1721400000000 } from '../src/database/migrations/1721400000000-rbac-schema';
import { TeamsSchema1721500000000 } from '../src/database/migrations/1721500000000-teams-schema';
import { MembersSchema1721600000000 } from '../src/database/migrations/1721600000000-members-schema';
import { PlatformLifecycleSchema1723800000000 } from '../src/database/migrations/1723800000000-platform-lifecycle-schema';
import { InvitationsTeamScope1724800000000 } from '../src/database/migrations/1724800000000-invitations-team-scope';

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

const MEMBER_EMAIL = `member-${randomUUID()}@example.test`;
const MEMBER_PASSWORD = 'correct-horse-battery-staple';
const PUBLIC_INVITATION_TOKEN =
  'public-invitation-token-with-sufficient-entropy';

interface SeededFixture {
  readonly dataSource: DataSource;
  readonly adminId: string;
}

const MIGRATIONS = [
  BaselineSchema1721200000000,
  IdentitySchema1721300000000,
  RbacSchema1721400000000,
  TeamsSchema1721500000000,
  MembersSchema1721600000000,
  PlatformLifecycleSchema1723800000000,
  InvitationsTeamScope1724800000000,
];

async function migrateAndSeed(): Promise<SeededFixture | null> {
  try {
    const dataSource = new DataSource({
      ...buildDataSourceOptions(TEST_DB_CONFIG),
      migrations: MIGRATIONS,
    });
    await dataSource.initialize();
    await dataSource.runMigrations();
    const memberId = randomUUID();
    const adminId = randomUUID();
    const passwordHash = await new PasswordHashAdapter().hash(MEMBER_PASSWORD);
    await dataSource.query(
      `INSERT INTO "users" ("id", "email", "role", "status") VALUES ($1, $2, $3, 'active')`,
      [memberId, MEMBER_EMAIL, Role.User],
    );
    await dataSource.query(
      `INSERT INTO "password_credentials" ("id", "user_id", "password_hash") VALUES ($1, $2, $3)`,
      [randomUUID(), memberId, passwordHash],
    );
    await dataSource.query(
      `INSERT INTO "users" ("id", "email", "role", "status") VALUES ($1, $2, $3, 'active')`,
      [adminId, `admin-${randomUUID()}@example.test`, Role.Admin],
    );
    return { dataSource, adminId };
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
  ? 'Identity (e2e, PostgreSQL)'
  : `Identity (e2e) (SKIPPED: test database unreachable at ${TEST_DB_HOST}:${TEST_DB_PORT} — start docker-compose.test.yml)`;

describeIfDb(suiteTitle, () => {
  const activeDataSource = seededDataSource;
  if (activeDataSource === null) {
    return;
  }

  let app: NestFastifyApplication;
  let adminToken: string;

  beforeAll(async () => {
    // Re-assert the test DB URL: sibling e2e suites reset DATABASE_URL in their
    // afterAll, and this suite's app is only created now.
    process.env['DATABASE_URL'] = TEST_DB_URL;
    app = await createApp();
    await configureSecurity(app);
    await configureValidation(app);
    configureLifecycle(app);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    const tokenPort = app.get<AuthTokenPort>(AUTH_TOKEN_PORT);
    adminToken = await tokenPort.sign({
      userId: seeded?.adminId ?? randomUUID(),
      email: 'inviter@example.test',
      roles: [Role.Admin],
    });
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

  async function login(password: string): Promise<request.Response> {
    return request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: MEMBER_EMAIL, password });
  }

  it('POST /auth/login returns the nested enriched frontend contract', async () => {
    const response = await login(MEMBER_PASSWORD);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      tokens: {
        accessToken: expect.any(String),
        refreshToken: expect.any(String),
      },
      user: {
        email: MEMBER_EMAIL,
        displayName: MEMBER_EMAIL,
        accountState: 'active',
        onboardingComplete: true,
        memberships: [],
      },
    });
    expect(response.body.user.permissions).toEqual(
      expect.arrayContaining(['team.read', 'practice.read']),
    );
    expect(response.body).not.toHaveProperty('accessToken');
    expect(response.body).not.toHaveProperty('refreshToken');
  });

  it('POST /auth/login rejects a wrong password generically', async () => {
    const response = await login('definitely-wrong-password');

    expect(response.status).toBe(401);
    expect(response.body.messageKey).toBe('errors.auth.invalidCredentials');
  });

  it('POST /auth/refresh rotates the session', async () => {
    const loggedIn = await login(MEMBER_PASSWORD);
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: loggedIn.body.tokens.refreshToken as string });

    expect(response.status).toBe(200);
    expect(response.body.refreshToken).toBeDefined();
    expect(response.body.refreshToken).not.toBe(
      loggedIn.body.tokens.refreshToken,
    );
  });

  it('POST /auth/refresh rejects an invalid token', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: 'not-a-real-refresh-token-value' });

    expect(response.status).toBe(401);
    expect(response.body.messageKey).toBe('errors.auth.invalidRefreshToken');
  });

  it('GET /auth/me returns the enriched current-user contract', async () => {
    const loggedIn = await login(MEMBER_PASSWORD);
    const response = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set(
        'Authorization',
        `Bearer ${loggedIn.body.tokens.accessToken as string}`,
      );

    expect(response.status).toBe(200);
    expect(response.body.email).toBe(MEMBER_EMAIL);
    expect(response.body.accountState).toBe('active');
    expect(response.body.permissions).toBeInstanceOf(Array);
    // A principal with no membership row gets an empty list, never a placeholder.
    expect(response.body.memberships).toEqual([]);
  });

  it('POST /auth/logout revokes the current session', async () => {
    const loggedIn = await login(MEMBER_PASSWORD);
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set(
        'Authorization',
        `Bearer ${loggedIn.body.tokens.accessToken as string}`,
      )
      .send({ refreshToken: loggedIn.body.tokens.refreshToken as string });

    expect(response.status).toBe(200);
    expect(response.body.message).toBeDefined();
  });

  it('lists active sessions and marks the access-token session current', async () => {
    const loggedIn = await login(MEMBER_PASSWORD);

    const response = await request(app.getHttpServer())
      .get('/api/v1/auth/sessions')
      .set(
        'Authorization',
        `Bearer ${loggedIn.body.tokens.accessToken as string}`,
      );

    expect(response.status).toBe(200);
    expect(response.body.sessions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: expect.any(String),
          current: true,
          approxLocation: '',
        }),
      ]),
    );
    expect(response.body.sessions).not.toContainEqual(
      expect.objectContaining({ refreshToken: expect.anything() }),
    );
  });

  it('rejects session listing without an access token', async () => {
    const response = await request(app.getHttpServer()).get(
      '/api/v1/auth/sessions',
    );

    expect(response.status).toBe(401);
  });

  it('revokes one owned session and removes it from the active list', async () => {
    await login(MEMBER_PASSWORD);
    const current = await login(MEMBER_PASSWORD);
    const authorization = `Bearer ${current.body.tokens.accessToken as string}`;

    const before = await request(app.getHttpServer())
      .get('/api/v1/auth/sessions')
      .set('Authorization', authorization);
    const target = (
      before.body.sessions as { id: string; current: boolean }[]
    ).find(session => !session.current);

    expect(target).toBeDefined();
    const revoked = await request(app.getHttpServer())
      .post(`/api/v1/auth/sessions/${target?.id ?? ''}/revoke`)
      .set('Authorization', authorization)
      .send({});

    expect(revoked.status).toBe(200);
    const after = await request(app.getHttpServer())
      .get('/api/v1/auth/sessions')
      .set('Authorization', authorization);
    expect(after.body.sessions).not.toContainEqual(
      expect.objectContaining({ id: target?.id }),
    );
  });

  it('revokes all other sessions while preserving the current session', async () => {
    await login(MEMBER_PASSWORD);
    const current = await login(MEMBER_PASSWORD);

    const revoked = await request(app.getHttpServer())
      .post('/api/v1/auth/sessions/revoke-others')
      .set(
        'Authorization',
        `Bearer ${current.body.tokens.accessToken as string}`,
      )
      .send({});

    expect(revoked.status).toBe(200);
    expect(revoked.body.revokedCount).toBeGreaterThan(0);

    const listed = await request(app.getHttpServer())
      .get('/api/v1/auth/sessions')
      .set(
        'Authorization',
        `Bearer ${current.body.tokens.accessToken as string}`,
      );
    expect(listed.body.sessions).toHaveLength(1);
    expect(listed.body.sessions[0].current).toBe(true);
  });

  it('returns the same not-found response for a foreign session id', async () => {
    const loggedIn = await login(MEMBER_PASSWORD);
    const foreignSessionId = randomUUID();
    const foreignUserId = randomUUID();
    await activeDataSource.query(
      `INSERT INTO "users" ("id", "email", "role", "status")
       VALUES ($1, $2, $3, 'active')`,
      [foreignUserId, `foreign-${foreignUserId}@example.test`, Role.User],
    );
    await activeDataSource.query(
      `INSERT INTO "refresh_sessions"
        ("id", "user_id", "token_hash", "family_id", "issued_at", "expires_at")
       VALUES ($1, $2, $3, $4, now(), now() + interval '1 day')`,
      [foreignSessionId, foreignUserId, randomUUID(), randomUUID()],
    );

    const response = await request(app.getHttpServer())
      .post(`/api/v1/auth/sessions/${foreignSessionId}/revoke`)
      .set(
        'Authorization',
        `Bearer ${loggedIn.body.tokens.accessToken as string}`,
      )
      .send({});

    expect(response.status).toBe(404);
    expect(response.body.messageKey).toBe('errors.identity.sessionNotFound');
    const rows = await activeDataSource.query(
      `SELECT "revoked_at" FROM "refresh_sessions" WHERE "id" = $1`,
      [foreignSessionId],
    );
    expect(rows[0].revoked_at).toBeNull();
  });

  it('POST /auth/forgot-password always returns a generic acknowledgement', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/forgot-password')
      .send({ email: `ghost-${randomUUID()}@example.test` });

    expect(response.status).toBe(200);
    expect(response.body.message).toBeDefined();
  });

  it('POST /auth/reset-password rejects an invalid token', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/reset-password')
      .send({
        token: 'not-a-real-reset-token-value-1234',
        password: 'brand-new-password-9',
      });

    expect(response.status).toBe(400);
    expect(response.body.messageKey).toBe('errors.identity.resetTokenInvalid');
  });

  it('POST /invitations creates a pending invitation and returns its one-time token', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/invitations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: `invitee-${randomUUID()}@example.test` });

    expect(response.status).toBe(201);
    expect(response.body.status).toBe('pending');
    expect(response.body.id).toBeDefined();
    // OD-002: no email provider, so the admin must be handed the invite link.
    expect(typeof response.body.token).toBe('string');
    expect(response.body.token.length).toBeGreaterThanOrEqual(20);
  });

  it('never accepts an admin-chosen password when creating an invitation', async () => {
    const email = `invitee-${randomUUID()}@example.test`;
    const response = await request(app.getHttpServer())
      .post('/api/v1/invitations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email, password: 'admin-chosen-secret-123' });

    // The invitation is email-first by contract: a password field is not part
    // of the DTO, so the whitelist rejects it rather than silently setting a
    // credential the invitee never chose.
    expect(response.status).toBe(400);
    expect(response.body.messageKey).toBe('errors.validation.failed');
    expect(JSON.stringify(response.body)).not.toContain(
      'admin-chosen-secret-123',
    );
  });

  it('onboards email-first: the invitee sets their own password and gets a session', async () => {
    const email = `invitee-${randomUUID()}@example.test`;
    const created = await request(app.getHttpServer())
      .post('/api/v1/invitations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email });
    const inviteToken = created.body.token as string;

    const inviteePassword = 'invitee-chosen-strong-passphrase';
    const accepted = await request(app.getHttpServer())
      .post('/api/v1/invitations/accept')
      .send({ token: inviteToken, password: inviteePassword });

    expect(accepted.status).toBe(201);
    expect(accepted.body.accessToken).toEqual(expect.any(String));
    expect(accepted.body.userId).toEqual(expect.any(String));

    // The invitee can now log in with the password they chose.
    const loggedIn = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: inviteePassword });
    expect(loggedIn.status).toBe(200);

    // The one-time token cannot be replayed once accepted.
    const replay = await request(app.getHttpServer())
      .post('/api/v1/invitations/accept')
      .send({ token: inviteToken, password: inviteePassword });
    expect(replay.status).toBe(400);
    expect(replay.body.messageKey).toBe('errors.identity.invitationInvalid');
  });

  it('enforces the password policy when the invitee accepts', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/invitations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: `invitee-${randomUUID()}@example.test` });

    const response = await request(app.getHttpServer())
      .post('/api/v1/invitations/accept')
      .send({ token: created.body.token as string, password: 'short' });

    expect(response.status).toBe(400);
    expect(response.body.messageKey).toBe('errors.validation.failed');
  });

  it('POST /invitations rejects an unprivileged caller', async () => {
    const tokenPort = app.get<AuthTokenPort>(AUTH_TOKEN_PORT);
    const memberToken = await tokenPort.sign({
      userId: randomUUID(),
      email: MEMBER_EMAIL,
      roles: [Role.User],
    });

    const response = await request(app.getHttpServer())
      .post('/api/v1/invitations')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ email: `invitee-${randomUUID()}@example.test` });

    expect(response.status).toBe(403);
    expect(response.body.messageKey).toBe('errors.auth.permissionDenied');
  });

  it('onboards a team-scoped invitee end-to-end: invite → accept → team context → member grants', async () => {
    // A real team, created through the platform surface.
    const teamCreated = await request(app.getHttpServer())
      .post('/api/v1/teams')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ slug: `onb-${randomUUID().slice(0, 8)}`, name: 'Onboarding FC' });
    expect(teamCreated.status).toBe(201);
    const teamId = teamCreated.body.id as string;

    // A team administrator whose member.invite grant is TEAM-scoped only.
    const teamAdminId = randomUUID();
    await activeDataSource.query(
      `INSERT INTO "users" ("id", "email", "role", "status")
       VALUES ($1, $2, $3, 'active')`,
      [teamAdminId, `teamadmin-${teamAdminId}@example.test`, Role.User],
    );
    const teamAdminRole = await activeDataSource.query(
      `SELECT "id" FROM "roles" WHERE "key" = 'TEAM_ADMIN'`,
    );
    await activeDataSource.query(
      `INSERT INTO "user_role_assignments" ("id", "user_id", "role_id", "team_id")
       VALUES ($1, $2, $3, $4)`,
      [randomUUID(), teamAdminId, teamAdminRole[0].id, teamId],
    );
    await activeDataSource.query(
      `UPDATE "rbac_policy_version" SET "version" = "version" + 1
        WHERE "singleton" = true`,
    );
    const tokenPort = app.get<AuthTokenPort>(AUTH_TOKEN_PORT);
    const teamAdminToken = await tokenPort.sign({
      userId: teamAdminId,
      email: 'teamadmin@example.test',
      roles: [Role.User],
    });

    // The membership pre-created by the members surface (profile email is the
    // claim key), exactly as the product invite flow does.
    const email = `invitee-${randomUUID()}@example.test`;
    const membership = await request(app.getHttpServer())
      .post(`/api/v1/teams/${teamId}/members/invite`)
      .set('Authorization', `Bearer ${teamAdminToken}`)
      .send({ profile: { fullName: 'Onboarded Member', email } });
    expect(membership.status).toBe(201);
    const membershipId = membership.body.id as string;

    // P0-2: the team-scoped route lets a team-scoped holder invite (this very
    // call returned 403 on the global-scope route the audit reproduced).
    const invitation = await request(app.getHttpServer())
      .post(`/api/v1/teams/${teamId}/invitations`)
      .set('Authorization', `Bearer ${teamAdminToken}`)
      .send({ email });
    expect(invitation.status).toBe(201);
    expect(invitation.body.teamId).toBe(teamId);
    expect(typeof invitation.body.token).toBe('string');

    // P0-1: acceptance links + activates the membership and grants MEMBER —
    // one transaction.
    const accepted = await request(app.getHttpServer())
      .post('/api/v1/invitations/accept')
      .send({
        token: invitation.body.token as string,
        password: 'invitee-chosen-strong-passphrase',
        displayName: 'Onboarded Member',
      });
    expect(accepted.status).toBe(201);
    const accessToken = accepted.body.accessToken as string;
    const inviteeId = accepted.body.userId as string;

    // /auth/me now carries the activated membership with the member role slug.
    const me = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(me.status).toBe(200);
    expect(me.body.memberships).toHaveLength(1);
    expect(me.body.memberships[0]).toMatchObject({
      teamId,
      membershipId,
      status: 'active',
      roles: ['member'],
    });

    // The scoped permission read returns the member grants for that team.
    const scoped = await request(app.getHttpServer())
      .get(`/api/v1/rbac/me/permissions?teamId=${teamId}`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(scoped.status).toBe(200);
    expect(scoped.body.permissions).toEqual(
      expect.arrayContaining([
        'team.read',
        'practice.read',
        'leaderboard.read',
      ]),
    );

    // Database truth: linked + activated membership, MEMBER assignment,
    // invited→active status history.
    const membershipRows = await activeDataSource.query(
      `SELECT "user_id", "status", "joined_at" FROM "memberships"
        WHERE "id" = $1`,
      [membershipId],
    );
    expect(membershipRows[0]).toMatchObject({
      user_id: inviteeId,
      status: 'active',
    });
    expect(membershipRows[0].joined_at).not.toBeNull();

    const assignments = await activeDataSource.query(
      `SELECT r."key" FROM "user_role_assignments" a
         JOIN "roles" r ON r."id" = a."role_id"
        WHERE a."user_id" = $1 AND a."team_id" = $2 AND a."revoked_at" IS NULL`,
      [inviteeId, teamId],
    );
    expect(assignments).toEqual([{ key: 'MEMBER' }]);

    const events = await activeDataSource.query(
      `SELECT "from_status", "to_status" FROM "membership_status_events"
        WHERE "membership_id" = $1 ORDER BY "occurred_at" ASC, "id" ASC`,
      [membershipId],
    );
    expect(events).toEqual([
      { from_status: null, to_status: 'invited' },
      { from_status: 'invited', to_status: 'active' },
    ]);

    // The one-time token cannot be replayed (idempotent accept).
    const replay = await request(app.getHttpServer())
      .post('/api/v1/invitations/accept')
      .send({
        token: invitation.body.token as string,
        password: 'invitee-chosen-strong-passphrase',
      });
    expect(replay.status).toBe(400);

    // P0-2 negative: the same team admin cannot invite into another team.
    const denied = await request(app.getHttpServer())
      .post(`/api/v1/teams/${randomUUID()}/invitations`)
      .set('Authorization', `Bearer ${teamAdminToken}`)
      .send({ email: `cross-${randomUUID()}@example.test` });
    expect(denied.status).toBe(403);
    expect(denied.body.messageKey).toBe('errors.auth.permissionDenied');
  });

  it('GET /auth/invitations/:token returns minimal pending details', async () => {
    const invitationId = randomUUID();
    const email = `public-invite-${invitationId}@example.test`;
    const tokenHash = createHash('sha256')
      .update(PUBLIC_INVITATION_TOKEN)
      .digest('hex');
    await activeDataSource.query(
      `INSERT INTO "invitations"
        ("id", "email", "token_hash", "invited_by", "role", "status", "expires_at")
       VALUES ($1, $2, $3, $4, $5, 'pending', now() + interval '1 day')`,
      [invitationId, email, tokenHash, seeded?.adminId, Role.User],
    );

    const response = await request(app.getHttpServer()).get(
      `/api/v1/auth/invitations/${PUBLIC_INVITATION_TOKEN}`,
    );

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      email,
      role: Role.User,
      inviterName: null,
      expiresAt: expect.any(String),
    });
    expect(JSON.stringify(response.body)).not.toContain(
      PUBLIC_INVITATION_TOKEN,
    );
  });

  it('GET /auth/invitations/:token generically rejects an unknown token', async () => {
    const response = await request(app.getHttpServer()).get(
      '/api/v1/auth/invitations/unknown-invitation-token-with-sufficient-length',
    );

    expect(response.status).toBe(400);
    expect(response.body.messageKey).toBe('errors.identity.invitationInvalid');
    expect(response.body).not.toHaveProperty('email');
  });
});
