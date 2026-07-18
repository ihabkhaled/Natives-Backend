import { loadSeedAdminConfig } from '@config/seed-admin.config';
import type { PasswordHashPort } from '@modules/auth';
import { PASSWORD_HASH_PORT } from '@modules/auth';
import { NestFactory } from '@nestjs/core';
import type { DataSource } from 'typeorm';

import { AppModule } from '@/app.module';

import { ADMIN_SEED_FAILED_PREFIX, DATA_SOURCE } from '../database.constants';
import {
  describeDatabaseCliError,
  writeDatabaseCliMessage,
} from '../database-cli.helpers';
import { runSeedAdmin } from './seed-admin';
import {
  ADMIN_CREATED_LABEL,
  ADMIN_ROLE_KEY,
  ADMIN_UPDATED_LABEL,
  DATABASE_CONNECTION_UNAVAILABLE_MESSAGE,
} from './seed-admin.constants';
import type { SeedAdminResult } from './seed-admin.types';

function reportResult(email: string, result: SeedAdminResult): void {
  const action = result.created ? ADMIN_CREATED_LABEL : ADMIN_UPDATED_LABEL;
  writeDatabaseCliMessage(`Administrator ${action}: ${email}`);
  writeDatabaseCliMessage(`  user id: ${result.userId}`);
  writeDatabaseCliMessage(`  role:    ${ADMIN_ROLE_KEY} (global scope)`);
}

async function main(): Promise<void> {
  const config = loadSeedAdminConfig();
  const app = await NestFactory.createApplicationContext(AppModule, {
    abortOnError: false,
    logger: ['error', 'warn'],
  });
  try {
    const dataSource = app.get<DataSource>(DATA_SOURCE);
    if (!dataSource.isInitialized) {
      throw new Error(DATABASE_CONNECTION_UNAVAILABLE_MESSAGE);
    }
    const passwordHash = app.get<PasswordHashPort>(PASSWORD_HASH_PORT);
    const result = await runSeedAdmin(dataSource, passwordHash, config);
    reportResult(config.email, result);
  } finally {
    await app.close();
  }
}

void main().catch((error: unknown) => {
  process.stderr.write(
    `${ADMIN_SEED_FAILED_PREFIX}: ${describeDatabaseCliError(error)}\n`,
  );
  process.exitCode = 1;
});
