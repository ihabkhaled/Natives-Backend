import { configureLifecycle } from '@app/bootstrap/configure-lifecycle';
import { configureSecurity } from '@app/bootstrap/configure-security';
import { configureValidation } from '@app/bootstrap/configure-validation';
import { createApp } from '@app/bootstrap/create-app';
import { buildDataSourceOptions } from '@app/database/data-source.factory';
import type { DatabaseConfig } from '@config/config.types';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

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

const VALID_BODY = {
  email: 'visitor@example.test',
  subject: 'Question about tryouts',
  message: 'When do winter tryouts open next season?',
};

async function probeDb(): Promise<boolean> {
  try {
    const dataSource = new DataSource(buildDataSourceOptions(TEST_DB_CONFIG));
    await dataSource.initialize();
    await dataSource.destroy();
    return true;
  } catch {
    return false;
  }
}

const ORIGINAL = { ...process.env };
process.env['DATABASE_URL'] = TEST_DB_URL;
process.env['DB_MIGRATIONS_RUN_ON_START'] = 'false';
process.env['DB_SEED_ON_START'] = 'false';
const dbReachable = await probeDb();

const describeIfDb = dbReachable ? describe : describe.skip;

async function bootApp(
  overrides: Record<string, string>,
): Promise<NestFastifyApplication> {
  for (const [key, value] of Object.entries(overrides)) {
    process.env[key] = value;
  }
  const app = await createApp();
  await configureSecurity(app);
  await configureValidation(app);
  configureLifecycle(app);
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  return app;
}

function restoreEnv(): void {
  for (const key of [
    'EMAIL_ENABLED',
    'EMAIL_PROVIDER',
    'EMAIL_TO',
    'RATE_LIMIT_MAX',
  ]) {
    if (ORIGINAL[key] === undefined) {
      Reflect.deleteProperty(process.env, key);
    } else {
      process.env[key] = ORIGINAL[key];
    }
  }
}

describeIfDb('Contact form (e2e, PostgreSQL)', () => {
  describe('when outbound email is enabled', () => {
    let app: NestFastifyApplication;

    beforeAll(async () => {
      app = await bootApp({
        EMAIL_ENABLED: 'true',
        EMAIL_PROVIDER: 'console',
        EMAIL_TO: 'ops@ultimatenatives.test',
        RATE_LIMIT_MAX: '100',
      });
    });

    afterAll(async () => {
      await app.close();
      restoreEnv();
    });

    it('accepts a valid submission and reports sent', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/contact')
        .send(VALID_BODY);

      expect(response.status).toBe(201);
      expect(response.body).toEqual({ sent: true });
    });

    it('rejects an invalid body', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/contact')
        .send({ email: 'nope', subject: 'x', message: 'short' });

      expect(response.status).toBe(400);
    });

    it('rejects unknown properties', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/contact')
        .send({ ...VALID_BODY, bcc: 'attacker@example.test' });

      expect(response.status).toBe(400);
    });
  });

  describe('when outbound email is disabled', () => {
    let app: NestFastifyApplication;

    beforeAll(async () => {
      app = await bootApp({
        EMAIL_ENABLED: 'false',
        EMAIL_PROVIDER: 'console',
        RATE_LIMIT_MAX: '100',
      });
    });

    afterAll(async () => {
      await app.close();
      restoreEnv();
    });

    it('is unavailable (503)', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/contact')
        .send(VALID_BODY);

      expect(response.status).toBe(503);
    });
  });

  describe('rate limiting', () => {
    let app: NestFastifyApplication;

    beforeAll(async () => {
      app = await bootApp({
        EMAIL_ENABLED: 'true',
        EMAIL_PROVIDER: 'console',
        EMAIL_TO: 'ops@ultimatenatives.test',
        RATE_LIMIT_MAX: '2',
      });
    });

    afterAll(async () => {
      await app.close();
      restoreEnv();
    });

    it('returns 429 once the limit is exceeded', async () => {
      const server = app.getHttpServer();
      await request(server).post('/api/v1/contact').send(VALID_BODY);
      await request(server).post('/api/v1/contact').send(VALID_BODY);
      const third = await request(server)
        .post('/api/v1/contact')
        .send(VALID_BODY);

      expect(third.status).toBe(429);
    });
  });
});
