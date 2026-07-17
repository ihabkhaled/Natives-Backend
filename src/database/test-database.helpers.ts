import type { DatabaseConfig } from '@config/config.types';
import { NodeEnv } from '@shared/enums';
import { DataSource } from 'typeorm';

import { buildDataSourceOptions } from './data-source.factory';
import {
  NON_TEST_DATABASE_MESSAGE,
  NON_TEST_ENV_MESSAGE,
  TEST_DATABASE_SUFFIX,
} from './database.constants';

function resolveDatabaseName(config: DatabaseConfig): string {
  if (config.url !== undefined) {
    return new URL(config.url).pathname.replace(/^\//u, '');
  }
  return config.name;
}

/**
 * Hard safeguard for destructive test-database operations: refuse to run unless
 * NODE_ENV is `test` AND the target database name ends with `_test`. This makes
 * it impossible to migrate/wipe a development or production database by mistake.
 */
export function assertTestDatabase(
  config: DatabaseConfig,
  nodeEnv: NodeEnv,
): void {
  if (nodeEnv !== NodeEnv.Test) {
    throw new Error(NON_TEST_ENV_MESSAGE);
  }
  if (!resolveDatabaseName(config).endsWith(TEST_DATABASE_SUFFIX)) {
    throw new Error(NON_TEST_DATABASE_MESSAGE);
  }
}

/**
 * Build a DataSource pointed at an isolated test database, but only after the
 * safeguard passes. Callers run migrations against it and dispose it per test.
 */
export function createTestDataSource(
  config: DatabaseConfig,
  nodeEnv: NodeEnv,
): DataSource {
  assertTestDatabase(config, nodeEnv);
  return new DataSource(buildDataSourceOptions(config));
}
