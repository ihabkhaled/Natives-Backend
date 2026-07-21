import { configureLifecycle } from '@app/bootstrap/configure-lifecycle';
import { configureSecurity } from '@app/bootstrap/configure-security';
import { configureValidation } from '@app/bootstrap/configure-validation';
import { createApp } from '@app/bootstrap/create-app';
import { AUTH_TOKEN_PORT, type AuthTokenPort } from '@core/auth';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { Role } from '@shared/enums';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Unreachable database URL: this suite is the boot-only, no-database smoke test.
// Pinning DATABASE_URL to an unreachable target makes the resolver degrade to the
// account-role baseline deterministically, regardless of sibling e2e suites that
// point DATABASE_URL at the test database during collection.
const UNREACHABLE_DATABASE_URL = 'postgres://none:none@127.0.0.1:1/none';

describe('App (e2e)', () => {
  let app: NestFastifyApplication;
  let authToken: string;
  let otherUserToken: string;
  let noPermissionToken: string;
  const originalDatabaseUrl = process.env['DATABASE_URL'];
  const originalCorsOrigin = process.env['CORS_ORIGIN'];
  const ALLOWED_ORIGIN = 'http://localhost:5173';

  beforeAll(async () => {
    process.env['DATABASE_URL'] = UNREACHABLE_DATABASE_URL;
    process.env['CORS_ORIGIN'] = ALLOWED_ORIGIN;
    app = await createApp();
    await configureSecurity(app);
    await configureValidation(app);
    configureLifecycle(app);

    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    // Identity is now persisted (prompt 101): login requires a live database and
    // is proven in the DB-gated integration + identity e2e suites. This boot-only
    // e2e signs access tokens directly through the token port so the transport
    // guards, permission checks, and article flows are exercised without a DB.
    const tokenPort = app.get<AuthTokenPort>(AUTH_TOKEN_PORT);
    authToken = await tokenPort.sign({
      userId: 'user-1',
      email: 'user@example.com',
      roles: [Role.User],
    });
    otherUserToken = await tokenPort.sign({
      userId: 'user-2',
      email: 'other@example.com',
      roles: [Role.User],
    });
    noPermissionToken = await tokenPort.sign({
      userId: 'user-3',
      email: 'restricted@example.com',
      roles: [],
    });
  });

  afterAll(async () => {
    await app.close();
    if (originalDatabaseUrl === undefined) {
      delete process.env['DATABASE_URL'];
    } else {
      process.env['DATABASE_URL'] = originalDatabaseUrl;
    }
    if (originalCorsOrigin === undefined) {
      delete process.env['CORS_ORIGIN'];
    } else {
      process.env['CORS_ORIGIN'] = originalCorsOrigin;
    }
  });

  it('CORS preflight allows every mutating verb the API exposes', async () => {
    // Regression: enableCors() without an explicit `methods` list reflected
    // only GET/HEAD/POST on the preflight response, so a browser silently
    // blocked every PUT/PATCH/DELETE request (e.g. member role updates) as a
    // CORS failure even though the server would have accepted it.
    const response = await request(app.getHttpServer())
      .options('/api/v1/members/00000000-0000-0000-0000-000000000000/roles')
      .set('Origin', ALLOWED_ORIGIN)
      .set('Access-Control-Request-Method', 'PUT')
      .set('Access-Control-Request-Headers', 'authorization,content-type');

    expect(response.status).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe(
      ALLOWED_ORIGIN,
    );
    const allowedMethods =
      response.headers['access-control-allow-methods'] ?? '';
    for (const method of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']) {
      expect(allowedMethods).toContain(method);
    }
  });

  it('GET /api/v1/health returns ok with security headers', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/health');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
  });

  it('GET /api/v1/auth/me without a token returns 401', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/auth/me');

    expect(response.status).toBe(401);
    expect(response.body.messageKey).toBe('errors.auth.tokenRequired');
  });

  it('POST /api/v1/articles without authentication returns 401', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/articles')
      .send({ title: 'Hello world', body: 'Body content' });

    expect(response.status).toBe(401);
    expect(response.body.messageKey).toBe('errors.auth.tokenRequired');
  });

  it('GET /api/v1/articles rejects an invalid bearer token', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/articles')
      .set('Authorization', 'Bearer invalid-token');

    expect(response.status).toBe(401);
    expect(response.body.messageKey).toBe('errors.auth.invalidToken');
  });

  it('POST /api/v1/auth/login rejects oversized credentials at the boundary', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'user@example.com',
        password: 'x'.repeat(129),
      });

    expect(response.status).toBe(400);
    expect(response.body.messageKey).toBe('errors.validation.failed');
  });

  it('POST /api/v1/auth/login enforces the bcrypt byte limit', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'user@example.com',
        password: '🔐'.repeat(19),
      });

    expect(response.status).toBe(400);
    expect(response.body.messageKey).toBe('errors.validation.failed');
  });

  it('POST /api/v1/auth/reset-password rejects a malformed body with 400', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/reset-password')
      .send({ token: 'short', password: 'short' });

    expect(response.status).toBe(400);
    expect(response.body.messageKey).toBe('errors.validation.failed');
  });

  it('GET /api/v1/articles rejects a caller without the required permission', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/articles')
      .set('Authorization', `Bearer ${noPermissionToken}`);

    expect(response.status).toBe(403);
    expect(response.body.messageKey).toBe('errors.auth.permissionDenied');
  });

  it('POST /api/v1/articles rejects an invalid DTO with 400 + messageKey', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/articles')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ title: 'ab' });

    expect(response.status).toBe(400);
    expect(response.body.messageKey).toBe('errors.validation.failed');
  });

  it('POST /api/v1/articles creates a draft article', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/articles')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ title: 'Hello world', body: 'Body content' });

    expect(response.status).toBe(201);
    expect(response.body.title).toBe('Hello world');
    expect(response.body.status).toBe('draft');
    expect(response.body.ownerId).toBe('user-1');
  });

  it('GET /api/v1/articles/:id returns 404 + messageKey for a missing article', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/articles/00000000-0000-4000-a000-000000000000')
      .set('Authorization', `Bearer ${authToken}`);

    expect(response.status).toBe(404);
    expect(response.body.messageKey).toBe('errors.article.notFound');
  });

  it('GET /api/v1/articles/:id returns 400 for a non-UUID id', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/articles/does-not-exist')
      .set('Authorization', `Bearer ${authToken}`);

    expect(response.status).toBe(400);
    expect(response.body.messageKey).toBe('errors.validation.invalidUuid');
  });

  it('GET /api/v1/articles/:id does not reveal another owner article', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/articles')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ title: 'Private article', body: 'Owner-only body' });

    const response = await request(app.getHttpServer())
      .get(`/api/v1/articles/${created.body.id as string}`)
      .set('Authorization', `Bearer ${otherUserToken}`);

    expect(response.status).toBe(404);
    expect(response.body.messageKey).toBe('errors.article.notFound');
  });

  it('GET /api/v1/articles excludes another owner items and total', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/articles')
      .set('Authorization', `Bearer ${otherUserToken}`);

    expect(response.status).toBe(200);
    expect(response.body.items).toEqual([]);
    expect(response.body.total).toBe(0);
  });

  it('GET /api/v1/articles returns a paginated envelope', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/articles')
      .set('Authorization', `Bearer ${authToken}`);

    expect(response.status).toBe(200);
    expect(response.body.items).toBeDefined();
    expect(response.body.total).toBeDefined();
    expect(response.body.limit).toBeDefined();
    expect(response.body.offset).toBeDefined();
  });
});
