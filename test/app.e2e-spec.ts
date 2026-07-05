import { AppModule } from '@app/app.module';
import { configureLifecycle } from '@app/bootstrap/configure-lifecycle';
import { configureSecurity } from '@app/bootstrap/configure-security';
import { configureValidation } from '@app/bootstrap/configure-validation';
import { createFastifyAdapter } from '@app/bootstrap/fastify-adapter';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

describe('App (e2e)', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication<NestFastifyApplication>(
      createFastifyAdapter(),
    );
    await configureSecurity(app);
    await configureValidation(app);
    configureLifecycle(app);

    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/health returns ok with security headers', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/health');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
  });

  it('POST /api/v1/articles rejects an invalid DTO with 400 + messageKey', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/articles')
      .send({ title: 'ab' });

    expect(response.status).toBe(400);
    expect(response.body.messageKey).toBe('errors.validation.failed');
  });

  it('POST /api/v1/articles creates a draft article', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/articles')
      .send({ title: 'Hello world', body: 'Body content' });

    expect(response.status).toBe(201);
    expect(response.body.title).toBe('Hello world');
    expect(response.body.status).toBe('draft');
  });

  it('GET /api/v1/articles/:id returns 404 + messageKey for a missing article', async () => {
    const response = await request(app.getHttpServer()).get(
      '/api/v1/articles/does-not-exist',
    );

    expect(response.status).toBe(404);
    expect(response.body.messageKey).toBe('errors.article.notFound');
  });
});
