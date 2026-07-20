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

async function migrateAndSeed(): Promise<SeededFixture | null> {
  try {
    const dataSource = new DataSource({
      ...buildDataSourceOptions(TEST_DB_CONFIG),
      migrations: [
        BaselineSchema1721200000000,
        IdentitySchema1721300000000,
        RbacSchema1721400000000,
        TeamsSchema1721500000000,
        MembersSchema1721600000000,
      ],
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
      await seededDataSource.undoLastMigration();
      await seededDataSource.undoLastMigration();
      await seededDataSource.undoLastMigration();
      await seededDataSource.undoLastMigration();
      await seededDataSource.undoLastMigration();
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

  it('POST /invitations creates a pending invitation for a privileged actor', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/invitations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: `invitee-${randomUUID()}@example.test` });

    expect(response.status).toBe(201);
    expect(response.body.status).toBe('pending');
    expect(response.body.id).toBeDefined();
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
