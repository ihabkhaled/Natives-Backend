import type { ErrorMessageKey } from '@core/errors/error.types';

// DI token for the initialized TypeORM DataSource. Only src/database resolves
// it; application code depends on the vendor-free ports instead.
export const DATA_SOURCE = Symbol('DATA_SOURCE');

// Postgres is the only supported engine; the literal is TypeORM's discriminant.
export const DATABASE_TYPE = 'postgres';
export const DATABASE_MIGRATIONS_TABLE = 'migrations';
export const MIGRATIONS_DIRECTORY = 'migrations';
// Match both the ts-node (src) and compiled (dist) migration files.
export const MIGRATIONS_GLOB = '*.{ts,js}';

export const DATABASE_LOG_CONTEXT = 'DatabaseModule';
export const DATABASE_CONNECTED_LOG = 'Database connection established';
export const DATABASE_CONNECTION_FAILED_LOG =
  'Database connection unavailable at startup; readiness will report not ready';
export const DATABASE_DISCONNECTED_LOG = 'Database connection closed';
export const DATABASE_READINESS_LOG_CONTEXT = 'DatabaseReadiness';
export const DATABASE_READINESS_FAILED_LOG = 'Database readiness probe failed';

// Cheapest possible liveness probe against Postgres.
export const DATABASE_READINESS_PROBE = 'SELECT 1';

export const DATABASE_ERROR_MESSAGE =
  'The database request could not be completed';
export const DATABASE_ERROR_MESSAGE_KEY: ErrorMessageKey =
  'errors.database.requestFailed';

// Test-database safeguard: refuse to run isolation helpers anywhere but a
// dedicated, disposable test database.
export const TEST_DATABASE_SUFFIX = '_test';
export const NON_TEST_ENV_MESSAGE =
  'Refusing to use test-database helpers outside NODE_ENV=test';
export const NON_TEST_DATABASE_MESSAGE =
  'Refusing to target a database whose name does not end with "_test"';
