import { afterEach, describe, expect, it } from 'vitest';

import { databaseConfig } from './database.config';

const DB_KEYS = [
  'DATABASE_URL',
  'DB_HOST',
  'DB_PORT',
  'DB_USERNAME',
  'DB_PASSWORD',
  'DB_NAME',
  'DB_POOL_MIN',
  'DB_POOL_MAX',
  'DB_CONNECT_TIMEOUT_MS',
  'DB_STATEMENT_TIMEOUT_MS',
  'DB_SSL',
  'DB_LOGGING',
  'DB_MIGRATIONS_RUN_ON_START',
  'DB_SEED_ON_START',
] as const;

function clearDatabaseEnv(): void {
  for (const key of DB_KEYS) {
    Reflect.deleteProperty(process.env, key);
  }
}

describe('databaseConfig', () => {
  afterEach(() => {
    clearDatabaseEnv();
  });

  it('applies development-safe defaults when nothing is set', () => {
    clearDatabaseEnv();

    const config = databaseConfig();

    expect(config).toEqual({
      url: undefined,
      host: 'localhost',
      port: 5432,
      username: 'postgres',
      password: undefined,
      name: 'ultimate_natives',
      poolMin: 2,
      poolMax: 10,
      connectTimeoutMs: 10_000,
      statementTimeoutMs: 15_000,
      ssl: false,
      logging: false,
      migrationsRunOnStart: true,
      seedOnStart: true,
    });
  });

  it('reads the boot-lifecycle flags from the environment', () => {
    clearDatabaseEnv();
    process.env['DB_MIGRATIONS_RUN_ON_START'] = 'false';
    process.env['DB_SEED_ON_START'] = 'false';

    const config = databaseConfig();

    expect(config.migrationsRunOnStart).toBe(false);
    expect(config.seedOnStart).toBe(false);
  });

  it('reads discrete connection fields and flags from the environment', () => {
    clearDatabaseEnv();
    process.env['DB_HOST'] = 'db.internal';
    process.env['DB_PORT'] = '6543';
    process.env['DB_USERNAME'] = 'svc';
    process.env['DB_PASSWORD'] = 'secret';
    process.env['DB_NAME'] = 'natives';
    process.env['DB_POOL_MIN'] = '1';
    process.env['DB_POOL_MAX'] = '20';
    process.env['DB_CONNECT_TIMEOUT_MS'] = '5000';
    process.env['DB_STATEMENT_TIMEOUT_MS'] = '9000';
    process.env['DB_SSL'] = 'true';
    process.env['DB_LOGGING'] = 'true';

    const config = databaseConfig();

    expect(config).toMatchObject({
      host: 'db.internal',
      port: 6543,
      username: 'svc',
      password: 'secret',
      name: 'natives',
      poolMin: 1,
      poolMax: 20,
      connectTimeoutMs: 5000,
      statementTimeoutMs: 9000,
      ssl: true,
      logging: true,
    });
  });

  it('prefers DATABASE_URL when provided', () => {
    clearDatabaseEnv();
    process.env['DATABASE_URL'] = 'postgres://user:pass@host:5432/db';

    expect(databaseConfig().url).toBe('postgres://user:pass@host:5432/db');
  });
});
