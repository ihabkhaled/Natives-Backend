import { loadSeedAdminConfig } from '@config/seed-admin.config';
import { loadSeedPersonasConfig } from '@config/seed-personas.config';
import { AppLogger } from '@core/logger';
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
import { SEED_APPLIED_BY_CLI } from './seed.constants';
import type { SeedOutcome } from './seed.types';
import { DATABASE_CONNECTION_UNAVAILABLE_MESSAGE } from './seed-admin.constants';
import { buildSeeders } from './seed-registry';
import { runSeeders } from './seed-runner';

// Seed the database through the once-only framework: the CLI is equally
// once-only, so re-running it after the first application is a clean no-op
// (each seeder is skipped via its `seed_history` row). The runtime admin
// credential is required only when a seeder actually runs — a fresh database.
function reportOutcomes(outcomes: readonly SeedOutcome[]): void {
  for (const outcome of outcomes) {
    writeDatabaseCliMessage(`Seed "${outcome.key}": ${outcome.application}`);
  }
}

async function main(): Promise<void> {
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
    const logger = await app.resolve(AppLogger);
    const seeders = buildSeeders({
      passwordHash,
      loadAdminConfig: loadSeedAdminConfig,
      loadPersonasConfig: loadSeedPersonasConfig,
    });
    const outcomes = await runSeeders(
      dataSource,
      seeders,
      logger,
      SEED_APPLIED_BY_CLI,
    );
    reportOutcomes(outcomes);
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
