import type { DatabaseConfig } from '@config/config.types';
import { describe, expect, it } from 'vitest';

import { buildDataSourceOptions } from './data-source.factory';
import { SnakeCaseNamingStrategy } from './snake-case-naming.strategy';

const DISCRETE_CONFIG: DatabaseConfig = {
  url: undefined,
  host: 'db.local',
  port: 6543,
  username: 'svc',
  password: 'pw',
  name: 'app',
  poolMin: 1,
  poolMax: 8,
  connectTimeoutMs: 5000,
  statementTimeoutMs: 7000,
  ssl: true,
  logging: true,
  migrationsRunOnStart: false,
  seedOnStart: false,
};

describe('buildDataSourceOptions', () => {
  it('always disables synchronize', () => {
    expect(buildDataSourceOptions(DISCRETE_CONFIG).synchronize).toBe(false);
  });

  it('maps discrete connection, pool, timeout, ssl, and logging settings', () => {
    const options = buildDataSourceOptions(DISCRETE_CONFIG);

    expect(options).toMatchObject({
      type: 'postgres',
      host: 'db.local',
      port: 6543,
      username: 'svc',
      password: 'pw',
      database: 'app',
      ssl: true,
      logging: true,
      poolSize: 8,
      connectTimeoutMS: 5000,
      migrationsTableName: 'migrations',
      extra: {
        min: 1,
        max: 8,
        connectionTimeoutMillis: 5000,
        statement_timeout: 7000,
      },
    });
    expect(options.namingStrategy).toBeInstanceOf(SnakeCaseNamingStrategy);
  });

  it('points migrations at the migrations directory', () => {
    const migrations = buildDataSourceOptions(DISCRETE_CONFIG)
      .migrations as string[];

    expect(migrations).toHaveLength(1);
    expect(migrations[0]?.replaceAll('\\', '/')).toContain(
      'database/migrations',
    );
    expect(
      migrations[0]
        ?.replaceAll('\\', '/')
        .endsWith('database/migrations/[0-9]*.{ts,js}'),
    ).toBe(true);
  });

  it('uses the connection url when present and omits discrete fields', () => {
    const options = buildDataSourceOptions({
      ...DISCRETE_CONFIG,
      url: 'postgres://user:pass@host:5432/db',
    });

    expect(options).toMatchObject({ url: 'postgres://user:pass@host:5432/db' });
    expect(options).not.toHaveProperty('host');
  });

  it('omits password when it is not configured', () => {
    const options = buildDataSourceOptions({
      ...DISCRETE_CONFIG,
      password: undefined,
    });

    expect(options).not.toHaveProperty('password');
    expect(options).toMatchObject({ host: 'db.local' });
  });
});
