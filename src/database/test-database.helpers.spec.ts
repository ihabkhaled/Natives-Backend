import type { DatabaseConfig } from '@config/config.types';
import { NodeEnv } from '@shared/enums';
import { describe, expect, it } from 'vitest';

import {
  assertTestDatabase,
  createTestDataSource,
} from './test-database.helpers';

const TEST_CONFIG: DatabaseConfig = {
  url: undefined,
  host: 'localhost',
  port: 5432,
  username: 'natives_test',
  password: 'natives_test',
  name: 'natives_test',
  poolMin: 1,
  poolMax: 4,
  connectTimeoutMs: 2000,
  statementTimeoutMs: 4000,
  ssl: false,
  logging: false,
  migrationsRunOnStart: false,
  seedOnStart: false,
};

describe('assertTestDatabase', () => {
  it('passes for a test env targeting a _test database', () => {
    expect(() => assertTestDatabase(TEST_CONFIG, NodeEnv.Test)).not.toThrow();
  });

  it('accepts a _test database supplied via connection url', () => {
    const urlConfig: DatabaseConfig = {
      ...TEST_CONFIG,
      url: 'postgres://u:p@localhost:5432/natives_test',
    };

    expect(() => assertTestDatabase(urlConfig, NodeEnv.Test)).not.toThrow();
  });

  it('refuses to run outside NODE_ENV=test', () => {
    expect(() => assertTestDatabase(TEST_CONFIG, NodeEnv.Development)).toThrow(
      'NODE_ENV=test',
    );
  });

  it('refuses a database whose name does not end with _test', () => {
    expect(() =>
      assertTestDatabase({ ...TEST_CONFIG, name: 'natives' }, NodeEnv.Test),
    ).toThrow('_test');
  });
});

describe('createTestDataSource', () => {
  it('builds a data source for a safe test database', () => {
    const dataSource = createTestDataSource(TEST_CONFIG, NodeEnv.Test);

    expect(dataSource.options.database).toBe('natives_test');
    expect(dataSource.options.synchronize).toBe(false);
  });

  it('refuses to build a data source for an unsafe database', () => {
    expect(() =>
      createTestDataSource(
        { ...TEST_CONFIG, name: 'production' },
        NodeEnv.Test,
      ),
    ).toThrow('_test');
  });
});
