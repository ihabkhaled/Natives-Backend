import { databaseConfig } from '@config/database.config';

import {
  DATABASE_ALREADY_EXISTS_MESSAGE,
  DATABASE_CREATED_MESSAGE,
  DATABASE_SETUP_FAILED_PREFIX,
} from './database.constants';
import {
  describeDatabaseCliError,
  writeDatabaseCliMessage,
} from './database-cli.helpers';
import { ensureDatabaseExists } from './ensure-database';

async function main(): Promise<void> {
  const created = await ensureDatabaseExists(databaseConfig());
  writeDatabaseCliMessage(
    created ? DATABASE_CREATED_MESSAGE : DATABASE_ALREADY_EXISTS_MESSAGE,
  );
}

void main().catch((error: unknown) => {
  process.stderr.write(
    `${DATABASE_SETUP_FAILED_PREFIX}: ${describeDatabaseCliError(error)}\n`,
  );
  process.exitCode = 1;
});
