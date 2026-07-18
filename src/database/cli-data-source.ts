import { databaseConfig } from '@config/database.config';
import { DataSource } from 'typeorm';

import { buildDataSourceOptions } from './data-source.factory';

/**
 * Standalone DataSource for the TypeORM CLI (migration:generate/run/revert/show).
 * It reads the same typed configuration the application uses, so migrations
 * always target the exact connection/pool/SSL settings the runtime expects.
 * The npm `migration:*` scripts register ts-node + tsconfig-paths so the `@`
 * aliases resolve. Provide DATABASE_URL or the discrete DB_* env vars first.
 */
export default new DataSource(buildDataSourceOptions(databaseConfig()));
