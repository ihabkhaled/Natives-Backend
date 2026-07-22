import { ClockModule } from '@core/clock/clock.module';
import { IdGeneratorModule } from '@core/id-generator/id-generator.module';
import { PlatformModule } from '@modules/platform';
import { Module } from '@nestjs/common';

import { DataQualityController } from './api/data-quality.controller';
import { ScanController } from './api/scan.controller';
import { AnomalyQueryService } from './application/anomaly-query.service';
import { DataQualityLookupService } from './application/dataquality-lookup.service';
import { RepairAnomalyUseCase } from './application/repair-anomaly.use-case';
import { ScanUseCase } from './application/scan.use-case';
import { TransitionAnomalyUseCase } from './application/transition-anomaly.use-case';
import { AnomalyRepository } from './infrastructure/anomaly.repository';
import { DetectionRepository } from './infrastructure/detection.repository';
import { RepairRepository } from './infrastructure/repair.repository';

/**
 * Data-quality rules, anomaly queues, and repairs (UN-705). Owns its persistence
 * (raw SQL via the global UnitOfWorkPort) and composes the platform audit
 * primitive.
 *
 * Three invariants shape the module. Detection is strictly READ-ONLY: a scan
 * folds findings into the queue by fingerprint, reopening a resolved-but-
 * recurring anomaly rather than closing it while the data is still wrong. Alerts
 * fire only for an ACTIONABLE severity and carry references, never a private
 * payload. And a repair is ALWAYS previewed before it is applied, runs through
 * this owning service with a recorded rollback — never a raw SQL sweep — and an
 * irreversible repair can never be rolled back.
 */
@Module({
  imports: [ClockModule, IdGeneratorModule, PlatformModule],
  controllers: [DataQualityController, ScanController],
  providers: [
    AnomalyRepository,
    RepairRepository,
    DetectionRepository,
    DataQualityLookupService,
    AnomalyQueryService,
    ScanUseCase,
    TransitionAnomalyUseCase,
    RepairAnomalyUseCase,
  ],
})
export class DataQualityModule {}
