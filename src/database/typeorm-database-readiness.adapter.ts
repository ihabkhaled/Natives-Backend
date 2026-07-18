import { AppLogger } from '@core/logger';
import type {
  DatabaseReadinessPort,
  DatabaseReadinessResult,
} from '@core/persistence/database-readiness.port';
import { Inject, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

import {
  DATA_SOURCE,
  DATABASE_READINESS_FAILED_LOG,
  DATABASE_READINESS_LOG_CONTEXT,
  DATABASE_READINESS_PROBE,
} from './database.constants';

/**
 * TypeORM implementation of the database readiness port. Runs a trivial probe
 * query and reports a plain boolean. Any failure is logged (without driver
 * internals or credentials) and surfaced as `reachable: false` so readiness
 * degrades safely instead of leaking errors.
 */
@Injectable()
export class TypeormDatabaseReadinessAdapter implements DatabaseReadinessPort {
  constructor(
    @Inject(DATA_SOURCE) private readonly dataSource: DataSource,
    private readonly logger: AppLogger,
  ) {
    this.logger.setContext(DATABASE_READINESS_LOG_CONTEXT);
  }

  async check(): Promise<DatabaseReadinessResult> {
    try {
      await this.ensureInitialized();
      await this.dataSource.query(DATABASE_READINESS_PROBE);
      return { reachable: true };
    } catch {
      this.logger.warn(DATABASE_READINESS_FAILED_LOG);
      return { reachable: false };
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.dataSource.isInitialized) {
      await this.dataSource.initialize();
    }
  }
}
