import { buildDataSourceOptions } from '@app/database/data-source.factory';
import { assertTestDatabase } from '@app/database/test-database.helpers';
import { TypeormDatabaseReadinessAdapter } from '@app/database/typeorm-database-readiness.adapter';
import { TypeormUnitOfWorkAdapter } from '@app/database/typeorm-unit-of-work.adapter';
import type { DatabaseConfig } from '@config/config.types';
import type { AppLogger } from '@core/logger';
import { NodeEnv } from '@shared/enums';
import { DataSource } from 'typeorm';
import { afterAll, describe, expect, it, vi } from 'vitest';

import { BaselineSchema1721200000000 } from '../../src/database/migrations/1721200000000-baseline-schema';

// A disposable, isolated PostgreSQL is expected on the loopback test port (see
// docker-compose.test.yml). If it is unreachable the whole suite is SKIPPED with
// a clear reason rather than failing — but it runs whenever Postgres is up.
const TEST_DB_CONFIG: DatabaseConfig = {
  url: process.env['TEST_DATABASE_URL'],
  host: process.env['TEST_DB_HOST'] ?? '127.0.0.1',
  port: Number(process.env['TEST_DB_PORT'] ?? '55432'),
  username: process.env['TEST_DB_USERNAME'] ?? 'natives_test',
  password: process.env['TEST_DB_PASSWORD'] ?? 'natives_test',
  name: process.env['TEST_DB_NAME'] ?? 'natives_test',
  poolMin: 1,
  poolMax: 4,
  connectTimeoutMs: 3000,
  statementTimeoutMs: 5000,
  ssl: false,
  logging: false,
};

function buildTestDataSource(): DataSource {
  assertTestDatabase(TEST_DB_CONFIG, NodeEnv.Test);
  return new DataSource({
    ...buildDataSourceOptions(TEST_DB_CONFIG),
    // Import the migration class statically so it is transpiled by the test
    // runner instead of being glob-loaded as raw TypeScript.
    migrations: [BaselineSchema1721200000000],
  });
}

async function connectOrNull(): Promise<DataSource | null> {
  try {
    const dataSource = buildTestDataSource();
    await dataSource.initialize();
    return dataSource;
  } catch {
    return null;
  }
}

function createLoggerMock() {
  return {
    setContext: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

const dataSource = await connectOrNull();
const describeIfDb = dataSource ? describe : describe.skip;
const suiteTitle = dataSource
  ? 'PostgreSQL integration'
  : `PostgreSQL integration (SKIPPED: unreachable at ${TEST_DB_CONFIG.host}:${TEST_DB_CONFIG.port} — start docker-compose.test.yml)`;

describeIfDb(suiteTitle, () => {
  const activeDataSource = dataSource;
  if (!activeDataSource) {
    return;
  }

  afterAll(async () => {
    await activeDataSource.query('DROP EXTENSION IF EXISTS "pgcrypto"');
    await activeDataSource.query('DROP TABLE IF EXISTS "migrations"');
    await activeDataSource.destroy();
  });

  it('reaches schema only through a reversible migration from empty', async () => {
    await activeDataSource.query('DROP EXTENSION IF EXISTS "pgcrypto"');
    await activeDataSource.query('DROP TABLE IF EXISTS "migrations"');

    await activeDataSource.runMigrations();

    const afterUp = await activeDataSource.query(
      "SELECT 1 AS present FROM pg_extension WHERE extname = 'pgcrypto'",
    );
    expect(afterUp).toHaveLength(1);
    const applied = await activeDataSource.query('SELECT * FROM "migrations"');
    expect(applied).toHaveLength(1);

    await activeDataSource.undoLastMigration();

    const afterDown = await activeDataSource.query(
      "SELECT 1 AS present FROM pg_extension WHERE extname = 'pgcrypto'",
    );
    expect(afterDown).toHaveLength(0);
  });

  it('commits work through the unit-of-work port', async () => {
    const unitOfWork = new TypeormUnitOfWorkAdapter(activeDataSource);
    await activeDataSource.query('DROP TABLE IF EXISTS "uow_commit_probe"');

    await unitOfWork.runInTransaction(async scope => {
      await scope.run('CREATE TABLE "uow_commit_probe" (id int PRIMARY KEY)');
      await scope.run('INSERT INTO "uow_commit_probe" (id) VALUES (1)');
    });

    const rows = await activeDataSource.query(
      'SELECT COUNT(*)::int AS count FROM "uow_commit_probe"',
    );
    expect(rows[0].count).toBe(1);
    await activeDataSource.query('DROP TABLE IF EXISTS "uow_commit_probe"');
  });

  it('rolls back all work when the transaction throws', async () => {
    const unitOfWork = new TypeormUnitOfWorkAdapter(activeDataSource);
    await activeDataSource.query('DROP TABLE IF EXISTS "uow_rollback_probe"');

    await expect(
      unitOfWork.runInTransaction(async scope => {
        await scope.run(
          'CREATE TABLE "uow_rollback_probe" (id int PRIMARY KEY)',
        );
        throw new Error('force rollback');
      }),
    ).rejects.toThrow();

    const exists = await activeDataSource.query(
      "SELECT to_regclass('public.uow_rollback_probe') AS relation",
    );
    expect(exists[0].relation).toBeNull();
  });

  it('round-trips a UTC instant through timestamptz', async () => {
    await activeDataSource.query('DROP TABLE IF EXISTS "utc_probe"');
    await activeDataSource.query(
      'CREATE TABLE "utc_probe" (id int PRIMARY KEY, at timestamptz NOT NULL)',
    );
    const instant = new Date('2024-06-01T12:34:56.000Z');

    await activeDataSource.query(
      'INSERT INTO "utc_probe" (id, at) VALUES (1, $1)',
      [instant.toISOString()],
    );
    const rows = await activeDataSource.query(
      'SELECT at FROM "utc_probe" WHERE id = 1',
    );

    expect(new Date(rows[0].at).toISOString()).toBe(instant.toISOString());
    await activeDataSource.query('DROP TABLE IF EXISTS "utc_probe"');
  });

  it('readiness reports reachable against a live database', async () => {
    const adapter = new TypeormDatabaseReadinessAdapter(
      activeDataSource,
      createLoggerMock() as unknown as AppLogger,
    );

    expect(await adapter.check()).toEqual({ reachable: true });
  });

  it('readiness reports unreachable when the database is down', async () => {
    const unreachable = new DataSource(
      buildDataSourceOptions({
        ...TEST_DB_CONFIG,
        url: undefined,
        port: 1,
        connectTimeoutMs: 1000,
      }),
    );
    const adapter = new TypeormDatabaseReadinessAdapter(
      unreachable,
      createLoggerMock() as unknown as AppLogger,
    );

    expect(await adapter.check()).toEqual({ reachable: false });
  });
});
