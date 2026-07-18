import { registerAs } from '@nestjs/config';

import {
  DATABASE_CONFIG_NAMESPACE,
  DEFAULT_DB_CONNECT_TIMEOUT_MS,
  DEFAULT_DB_HOST,
  DEFAULT_DB_NAME,
  DEFAULT_DB_POOL_MAX,
  DEFAULT_DB_POOL_MIN,
  DEFAULT_DB_PORT,
  DEFAULT_DB_STATEMENT_TIMEOUT_MS,
  DEFAULT_DB_USERNAME,
} from './config.constants';
import type { DatabaseConfig } from './config.types';
import { parseBoolean, parseInteger } from './config.utils';

/**
 * Typed, fail-fast database configuration. The only place database env vars are
 * read. Prefers DATABASE_URL when present and otherwise assembles a discrete
 * connection from host/port/username/password/name with development-safe
 * defaults. Cross-field rules (pool bounds, production SSL) live in
 * env.validation.ts so an invalid environment never reaches this factory.
 */
export const databaseConfig = registerAs(
  DATABASE_CONFIG_NAMESPACE,
  (): DatabaseConfig => ({
    url: process.env['DATABASE_URL'],
    host: process.env['DB_HOST'] ?? DEFAULT_DB_HOST,
    port: parseInteger(process.env['DB_PORT'], DEFAULT_DB_PORT),
    username: process.env['DB_USERNAME'] ?? DEFAULT_DB_USERNAME,
    password: process.env['DB_PASSWORD'],
    name: process.env['DB_NAME'] ?? DEFAULT_DB_NAME,
    poolMin: parseInteger(process.env['DB_POOL_MIN'], DEFAULT_DB_POOL_MIN),
    poolMax: parseInteger(process.env['DB_POOL_MAX'], DEFAULT_DB_POOL_MAX),
    connectTimeoutMs: parseInteger(
      process.env['DB_CONNECT_TIMEOUT_MS'],
      DEFAULT_DB_CONNECT_TIMEOUT_MS,
    ),
    statementTimeoutMs: parseInteger(
      process.env['DB_STATEMENT_TIMEOUT_MS'],
      DEFAULT_DB_STATEMENT_TIMEOUT_MS,
    ),
    ssl: parseBoolean(process.env['DB_SSL'], false),
    logging: parseBoolean(process.env['DB_LOGGING'], false),
  }),
);
