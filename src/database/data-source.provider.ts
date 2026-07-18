import { AppConfigService } from '@config/app-config.service';
import { AppLogger } from '@core/logger';
import type { Provider } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { buildDataSourceOptions } from './data-source.factory';
import {
  DATA_SOURCE,
  DATABASE_CONNECTED_LOG,
  DATABASE_CONNECTION_FAILED_LOG,
  DATABASE_LOG_CONTEXT,
} from './database.constants';

// Startup is resilient: a failed connection is logged (host + database name
// only — never credentials) and the process still boots so liveness stays up
// while readiness reports not-ready. `synchronize` is always false. Database
// creation and migrations are explicit operator actions (`npm run db:setup`);
// normal startup therefore needs no CREATE DATABASE privilege.
async function initializeDataSource(
  config: AppConfigService,
  logger: AppLogger,
): Promise<DataSource> {
  logger.setContext(DATABASE_LOG_CONTEXT);
  const database = config.database;
  const dataSource = new DataSource(buildDataSourceOptions(database));
  try {
    await dataSource.initialize();
    logger.info(DATABASE_CONNECTED_LOG, {
      host: database.host,
      database: database.name,
    });
  } catch {
    logger.error(DATABASE_CONNECTION_FAILED_LOG, {
      host: database.host,
      database: database.name,
    });
  }
  return dataSource;
}

export const dataSourceProvider: Provider = {
  provide: DATA_SOURCE,
  inject: [AppConfigService, AppLogger],
  useFactory: (
    config: AppConfigService,
    logger: AppLogger,
  ): Promise<DataSource> => initializeDataSource(config, logger),
};
