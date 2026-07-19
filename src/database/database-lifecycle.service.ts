import { AppConfigService } from '@config/app-config.service';
import { AppLogger } from '@core/logger';
import { Inject, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { withDatabaseAdvisoryLock } from './advisory-lock';
import {
  DATA_SOURCE,
  DATABASE_LIFECYCLE_LOCK_KEY,
  DATABASE_LIFECYCLE_LOG_CONTEXT,
  DATABASE_LIFECYCLE_SKIPPED_LOG,
  MIGRATIONS_MANAGED_EXTERNALLY_LOG,
} from './database.constants';
import { runPendingMigrations } from './migration-runner';
import { SEED_APPLIED_BY_BOOT } from './seeds/seed.constants';
import type { Seeder } from './seeds/seed.types';
import { runSeeders } from './seeds/seed-runner';

/**
 * Boot-time database lifecycle. After config, before the server serves: apply
 * pending migrations (`DB_MIGRATIONS_RUN_ON_START`) and run the once-only seed
 * framework (`DB_SEED_ON_START`) behind a single Postgres advisory lock so
 * concurrent instances never double-run. A migration failure propagates to abort
 * the boot — traffic is never served on a wrong schema. When migrations-on-start
 * is off, that is logged (the schema is expected to be applied externally).
 */
@Injectable()
export class DatabaseLifecycleService {
  constructor(
    @Inject(DATA_SOURCE) private readonly dataSource: DataSource,
    private readonly config: AppConfigService,
    private readonly logger: AppLogger,
  ) {
    this.logger.setContext(DATABASE_LIFECYCLE_LOG_CONTEXT);
  }

  async run(seeders: readonly Seeder[]): Promise<void> {
    const { migrationsRunOnStart, seedOnStart } = this.config.database;
    if (!migrationsRunOnStart) {
      this.logger.info(MIGRATIONS_MANAGED_EXTERNALLY_LOG);
    }
    if (!migrationsRunOnStart && !seedOnStart) {
      return;
    }
    if (!this.dataSource.isInitialized) {
      this.logger.warn(DATABASE_LIFECYCLE_SKIPPED_LOG);
      return;
    }
    await withDatabaseAdvisoryLock(
      this.dataSource,
      DATABASE_LIFECYCLE_LOCK_KEY,
      () => this.applyLifecycle(seeders, migrationsRunOnStart, seedOnStart),
    );
  }

  private async applyLifecycle(
    seeders: readonly Seeder[],
    migrate: boolean,
    seed: boolean,
  ): Promise<void> {
    if (migrate) {
      await runPendingMigrations(this.dataSource, this.logger);
    }
    if (seed) {
      await runSeeders(
        this.dataSource,
        seeders,
        this.logger,
        SEED_APPLIED_BY_BOOT,
      );
    }
  }
}
