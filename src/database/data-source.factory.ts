import { join } from 'node:path';

import type { DatabaseConfig } from '@config/config.types';
import type { DataSourceOptions } from 'typeorm';

import {
  DATABASE_MIGRATIONS_TABLE,
  DATABASE_TYPE,
  MIGRATIONS_DIRECTORY,
  MIGRATIONS_GLOB,
} from './database.constants';
import { SnakeCaseNamingStrategy } from './snake-case-naming.strategy';

/**
 * Build the TypeORM DataSource options from typed application config. This is
 * the single source of truth for connection, pool, timeout, SSL, logging, and
 * migration settings shared by the runtime provider, the CLI, and tests.
 * `synchronize` is hard-coded `false` — the schema is only ever changed through
 * migrations. Credentials are never logged from here.
 */
export function buildDataSourceOptions(
  config: DatabaseConfig,
): DataSourceOptions {
  const connection =
    config.url !== undefined
      ? { url: config.url }
      : {
          host: config.host,
          port: config.port,
          username: config.username,
          database: config.name,
          ...(config.password !== undefined
            ? { password: config.password }
            : {}),
        };

  return {
    type: DATABASE_TYPE,
    ...connection,
    synchronize: false,
    namingStrategy: new SnakeCaseNamingStrategy(),
    entities: [],
    migrations: [join(__dirname, MIGRATIONS_DIRECTORY, MIGRATIONS_GLOB)],
    migrationsTableName: DATABASE_MIGRATIONS_TABLE,
    ssl: config.ssl,
    logging: config.logging,
    poolSize: config.poolMax,
    connectTimeoutMS: config.connectTimeoutMs,
    extra: {
      min: config.poolMin,
      max: config.poolMax,
      connectionTimeoutMillis: config.connectTimeoutMs,
      statement_timeout: config.statementTimeoutMs,
    },
  };
}
