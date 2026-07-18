import { ClockModule } from '@core/clock/clock.module';
import { IdGeneratorModule } from '@core/id-generator/id-generator.module';
import { PlatformModule } from '@modules/platform';
import { Module } from '@nestjs/common';

import { AssessmentCatalogController } from './api/assessment-catalog.controller';
import { AssessmentPeriodController } from './api/assessment-period.controller';
import { AssessmentTemplateController } from './api/assessment-template.controller';
import { ArchiveMetricUseCase } from './application/archive-metric.use-case';
import { AssessmentQueryService } from './application/assessment-query.service';
import { AssessmentScopeService } from './application/assessment-scope.service';
import { CreateMetricUseCase } from './application/create-metric.use-case';
import { CreateMetricVersionUseCase } from './application/create-metric-version.use-case';
import { CreatePeriodUseCase } from './application/create-period.use-case';
import { CreateTemplateUseCase } from './application/create-template.use-case';
import { CreateTemplateVersionUseCase } from './application/create-template-version.use-case';
import { PublishTemplateUseCase } from './application/publish-template.use-case';
import { AssessmentCatalogRepository } from './infrastructure/assessment-catalog.repository';
import { AssessmentScopeRepository } from './infrastructure/assessment-scope.repository';

/**
 * Assessment metric-catalog bounded context (UN-300): categories, configurable
 * scales (null-not-zero), versioned team metric definitions with effective
 * created-at instants, templates with category weights + ordered metrics, and
 * dated assessment periods. Owns its persistence (raw SQL via the global
 * UnitOfWorkPort) and composes the platform audit primitive so every write is
 * recorded atomically. Definitions and published templates are immutable —
 * changes create new versions. No other module imports its internals.
 */
@Module({
  imports: [ClockModule, IdGeneratorModule, PlatformModule],
  controllers: [
    AssessmentCatalogController,
    AssessmentTemplateController,
    AssessmentPeriodController,
  ],
  providers: [
    AssessmentCatalogRepository,
    AssessmentScopeRepository,
    AssessmentScopeService,
    AssessmentQueryService,
    CreateMetricUseCase,
    CreateMetricVersionUseCase,
    ArchiveMetricUseCase,
    CreateTemplateUseCase,
    CreateTemplateVersionUseCase,
    PublishTemplateUseCase,
    CreatePeriodUseCase,
  ],
})
export class AssessmentsModule {}
