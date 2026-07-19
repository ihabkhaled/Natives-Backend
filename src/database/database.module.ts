import { DATABASE_READINESS_PORT } from '@core/persistence/database-readiness.port';
import { UNIT_OF_WORK_PORT } from '@core/persistence/unit-of-work.port';
import type { OnApplicationShutdown } from '@nestjs/common';
import { Global, Inject, Module } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { dataSourceProvider } from './data-source.provider';
import { DATA_SOURCE } from './database.constants';
import { DatabaseLifecycleService } from './database-lifecycle.service';
import { TypeormDatabaseReadinessAdapter } from './typeorm-database-readiness.adapter';
import { TypeormUnitOfWorkAdapter } from './typeorm-unit-of-work.adapter';

/**
 * Owns the persistence vendor (TypeORM + pg). Provides the initialized
 * DataSource and the application-owned ports (unit of work, readiness) that the
 * rest of the app depends on. Closes the connection on shutdown. TypeORM is
 * imported only inside src/database — nothing above this layer sees it.
 */
@Global()
@Module({
  providers: [
    dataSourceProvider,
    DatabaseLifecycleService,
    { provide: UNIT_OF_WORK_PORT, useClass: TypeormUnitOfWorkAdapter },
    {
      provide: DATABASE_READINESS_PORT,
      useClass: TypeormDatabaseReadinessAdapter,
    },
  ],
  exports: [
    DATA_SOURCE,
    DatabaseLifecycleService,
    UNIT_OF_WORK_PORT,
    DATABASE_READINESS_PORT,
  ],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(@Inject(DATA_SOURCE) private readonly dataSource: DataSource) {}

  async onApplicationShutdown(): Promise<void> {
    if (this.dataSource.isInitialized) {
      await this.dataSource.destroy();
    }
  }
}
