import type { ErrorMessageKey } from '@core/errors/error.types';

// DI token for the initialized TypeORM DataSource. Only src/database resolves
// it; application code depends on the vendor-free ports instead.
export const DATA_SOURCE = Symbol('DATA_SOURCE');

// Postgres is the only supported engine; the literal is TypeORM's discriminant.
export const DATABASE_TYPE = 'postgres';
export const DATABASE_MIGRATIONS_TABLE = 'migrations';
export const MIGRATIONS_DIRECTORY = 'migrations';
// Match timestamp-named migrations in both ts-node (src) and compiled (dist)
// without importing colocated specs or helper modules into the runtime.
export const MIGRATIONS_GLOB = '[0-9]*.{ts,js}';

export const DATABASE_LOG_CONTEXT = 'DatabaseModule';
export const DATABASE_CONNECTED_LOG = 'Database connection established';
export const DATABASE_CONNECTION_FAILED_LOG =
  'Database connection unavailable at startup; readiness will report not ready';
export const DATABASE_DISCONNECTED_LOG = 'Database connection closed';

// Explicit local/operator setup connects to the always-present maintenance
// database to check for and create the configured application database.
export const MAINTENANCE_DATABASE = 'postgres';
export const DEFAULT_POSTGRES_PORT = 5432;
export const DATABASE_CREATED_MESSAGE = 'Target database created';
export const DATABASE_ALREADY_EXISTS_MESSAGE = 'Target database already exists';
export const DATABASE_SETUP_FAILED_PREFIX = 'Database setup failed';
export const ADMIN_SEED_FAILED_PREFIX = 'Admin seed failed';
export const UNKNOWN_DATABASE_CLI_ERROR = 'Unknown error';
// A database name is a bare SQL identifier we interpolate into CREATE DATABASE
// (which forbids bind parameters), so it must match a strict allow-list before
// being double-quoted. Anything outside this pattern is rejected, not escaped.
export const SAFE_DATABASE_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_$]*$/u;
export const UNSAFE_DATABASE_NAME_MESSAGE =
  'Database name is not a safe PostgreSQL identifier';
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
