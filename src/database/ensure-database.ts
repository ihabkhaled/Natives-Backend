import type { DatabaseConfig } from '@config/config.types';
import type { ClientConfig } from 'pg';
import { Client } from 'pg';

import {
  DEFAULT_POSTGRES_PORT,
  MAINTENANCE_DATABASE,
  SAFE_DATABASE_NAME_PATTERN,
  UNSAFE_DATABASE_NAME_MESSAGE,
} from './database.constants';

const LEADING_SLASH = /^\//u;

/**
 * Explicitly ensure the configured application database exists. Returns true
 * only when this call creates it. Failures propagate so setup exits non-zero;
 * normal application startup never calls this function and therefore never
 * needs CREATE DATABASE privilege.
 */
export async function ensureDatabaseExists(
  config: DatabaseConfig,
): Promise<boolean> {
  const targetDatabase = resolveTargetDatabaseName(config);
  if (!SAFE_DATABASE_NAME_PATTERN.test(targetDatabase)) {
    throw new Error(UNSAFE_DATABASE_NAME_MESSAGE);
  }

  const client = new Client(buildMaintenanceClientConfig(config));
  try {
    await client.connect();
    return await createDatabaseIfMissing(client, targetDatabase);
  } finally {
    await closeQuietly(client);
  }
}

async function createDatabaseIfMissing(
  client: Client,
  targetDatabase: string,
): Promise<boolean> {
  const existing = await client.query(
    'SELECT 1 FROM pg_database WHERE datname = $1',
    [targetDatabase],
  );
  if (existing.rowCount !== null && existing.rowCount > 0) {
    return false;
  }

  // CREATE DATABASE forbids bind parameters. The caller validates this name
  // against SAFE_DATABASE_NAME_PATTERN before it is quoted as an identifier.
  await client.query(`CREATE DATABASE "${targetDatabase}"`);
  return true;
}

async function closeQuietly(client: Client): Promise<void> {
  try {
    await client.end();
  } catch {
    // Do not mask the setup failure if the maintenance connection is already
    // closed. A successful setup is also not invalidated by teardown noise.
  }
}

function buildMaintenanceClientConfig(config: DatabaseConfig): ClientConfig {
  const ssl = config.ssl ? { rejectUnauthorized: false } : undefined;
  if (config.url !== undefined) {
    const parsed = new URL(config.url);
    return {
      host: parsed.hostname,
      port: parsed.port === '' ? DEFAULT_POSTGRES_PORT : Number(parsed.port),
      user: decodeURIComponent(parsed.username),
      password:
        parsed.password === ''
          ? undefined
          : decodeURIComponent(parsed.password),
      database: MAINTENANCE_DATABASE,
      ssl,
    };
  }
  return {
    host: config.host,
    port: config.port,
    user: config.username,
    password: config.password,
    database: MAINTENANCE_DATABASE,
    ssl,
  };
}

function resolveTargetDatabaseName(config: DatabaseConfig): string {
  if (config.url !== undefined) {
    const path = new URL(config.url).pathname.replace(LEADING_SLASH, '');
    return path === '' ? config.name : decodeURIComponent(path);
  }
  return config.name;
}
