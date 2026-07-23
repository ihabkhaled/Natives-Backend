import { buildDataSourceOptions } from '@app/database/data-source.factory';
import { runPendingMigrations } from '@app/database/migration-runner';
import type { DatabaseConfig } from '@config/config.types';
import type { AppLogger } from '@core/logger';
import { Client } from 'pg';
import type { MigrationInterface, QueryRunner } from 'typeorm';
import { DataSource } from 'typeorm';
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

const HOST = process.env['TEST_DB_HOST'] ?? '127.0.0.1';
const PORT = Number(process.env['TEST_DB_PORT'] ?? '55432');
const USER = process.env['TEST_DB_USERNAME'] ?? 'natives_test';
const PASSWORD = process.env['TEST_DB_PASSWORD'] ?? 'natives_test';
const ATOMICITY_DB = 'natives_migration_atomicity_test';
const MAINTENANCE_DB = 'postgres';
const PROBE_TABLE = 'atomicity_probe_sources';
const SECOND_TABLE = 'atomicity_probe_links';
const MIGRATION_NAME = 'AtomicityProbeSchema1799000000000';

const ATOMICITY_CONFIG: DatabaseConfig = {
  url: undefined,
  host: HOST,
  port: PORT,
  username: USER,
  password: PASSWORD,
  name: ATOMICITY_DB,
  poolMin: 1,
  poolMax: 4,
  connectTimeoutMs: 3000,
  statementTimeoutMs: 10_000,
  ssl: false,
  logging: false,
  migrationsRunOnStart: true,
  seedOnStart: false,
};

/**
 * Replays the real incident: a migration whose first CREATE TABLE succeeds and
 * whose next statement fails (a killed/crashed boot mid-migration). Without a
 * per-migration transaction the first table persists with no completion record
 * and every later boot dies on "relation … already exists".
 */
class FailingProbeMigration implements MigrationInterface {
  readonly name = MIGRATION_NAME;

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "${PROBE_TABLE}" ("id" uuid PRIMARY KEY)`,
    );
    await queryRunner.query(`SELECT 1 / 0`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "${PROBE_TABLE}"`);
  }
}

/** The healthy variant of the SAME migration (same name), as after a fix. */
class FixedProbeMigration implements MigrationInterface {
  readonly name = MIGRATION_NAME;

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "${PROBE_TABLE}" ("id" uuid PRIMARY KEY)`,
    );
    await queryRunner.query(
      `CREATE TABLE "${SECOND_TABLE}" ("id" uuid PRIMARY KEY)`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "${SECOND_TABLE}"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "${PROBE_TABLE}"`);
  }
}

function buildLogger(): AppLogger {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    setContext: vi.fn(),
  } as unknown as AppLogger;
}

function buildProbeDataSource(
  migration: new () => MigrationInterface,
): DataSource {
  return new DataSource({
    ...buildDataSourceOptions(ATOMICITY_CONFIG),
    migrations: [migration],
  });
}

async function tableExists(
  dataSource: DataSource,
  table: string,
): Promise<boolean> {
  const rows = await dataSource.query(
    `SELECT to_regclass($1)::text AS "name"`,
    [`public.${table}`],
  );
  return rows[0]?.name !== null;
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

const maintenance = await connectMaintenanceOrNull();
const describeIfDb = maintenance ? describe : describe.skip;
const suiteTitle = maintenance
  ? 'Boot migration atomicity integration'
  : `Boot migration atomicity integration (SKIPPED: unreachable at ${HOST}:${PORT} — start docker-compose.test.yml)`;

describeIfDb(suiteTitle, () => {
  const client = maintenance;
  if (!client) {
    return;
  }
  const active: DataSource[] = [];

  function track(dataSource: DataSource): DataSource {
    active.push(dataSource);
    return dataSource;
  }

  beforeEach(async () => {
    await client.query(
      `DROP DATABASE IF EXISTS "${ATOMICITY_DB}" WITH (FORCE)`,
    );
    await client.query(`CREATE DATABASE "${ATOMICITY_DB}"`);
  });

  afterEach(async () => {
    for (const dataSource of active.splice(0)) {
      if (dataSource.isInitialized) {
        await dataSource.destroy();
      }
    }
  });

  afterAll(async () => {
    await client.query(
      `DROP DATABASE IF EXISTS "${ATOMICITY_DB}" WITH (FORCE)`,
    );
    await client.end();
  });

  it('rolls back a mid-migration failure completely and applies cleanly on re-run', async () => {
    const failing = track(buildProbeDataSource(FailingProbeMigration));
    await failing.initialize();

    await expect(runPendingMigrations(failing, buildLogger())).rejects.toThrow(
      /division by zero/,
    );

    // No partial schema: the CREATE TABLE that succeeded before the failure is
    // gone, and no completion record (nor the migrations table itself, created
    // inside the same rolled-back transaction) survives.
    expect(await tableExists(failing, PROBE_TABLE)).toBe(false);
    expect(await tableExists(failing, 'migrations')).toBe(false);
    await failing.destroy();

    // The fixed boot (same migration name) applies cleanly — the incident's
    // "relation already exists" death can no longer happen.
    const fixed = track(buildProbeDataSource(FixedProbeMigration));
    await fixed.initialize();
    const applied = await runPendingMigrations(fixed, buildLogger());

    expect(applied).toEqual([MIGRATION_NAME]);
    expect(await tableExists(fixed, PROBE_TABLE)).toBe(true);
    expect(await tableExists(fixed, SECOND_TABLE)).toBe(true);
    const recorded = await fixed.query(`SELECT "name" FROM "migrations"`);
    expect(recorded).toEqual([{ name: MIGRATION_NAME }]);
  });

  it('re-running after a successful apply is a no-op (idempotent record)', async () => {
    const first = track(buildProbeDataSource(FixedProbeMigration));
    await first.initialize();
    await runPendingMigrations(first, buildLogger());

    const applied = await runPendingMigrations(first, buildLogger());

    expect(applied).toEqual([]);
    const count = await first.query(
      `SELECT COUNT(*)::int AS "count" FROM "migrations"`,
    );
    expect(count[0]?.count).toBe(1);
  });
});
