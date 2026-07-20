import { ClockModule } from '@core/clock/clock.module';
import { IdGeneratorModule } from '@core/id-generator/id-generator.module';
import { PlatformModule } from '@modules/platform';
import { Module } from '@nestjs/common';

import { AssessmentCatalogController } from './api/assessment-catalog.controller';
import { AssessmentPeriodController } from './api/assessment-period.controller';
import { AssessmentTemplateController } from './api/assessment-template.controller';
import { PlayerAssessmentController } from './api/player-assessment.controller';
import { PlayerAssessmentSelfController } from './api/player-assessment-self.controller';
import { ArchiveMetricUseCase } from './application/archive-metric.use-case';
import { AssessmentDashboardSignalsService } from './application/assessment-dashboard-signals.service';
import { AssessmentQueryService } from './application/assessment-query.service';
import { AssessmentScopeService } from './application/assessment-scope.service';
import { CorrectPlayerAssessmentUseCase } from './application/correct-player-assessment.use-case';
import { CreateMetricUseCase } from './application/create-metric.use-case';
import { CreateMetricVersionUseCase } from './application/create-metric-version.use-case';
import { CreatePeriodUseCase } from './application/create-period.use-case';
import { CreatePlayerAssessmentUseCase } from './application/create-player-assessment.use-case';
import { CreateTemplateUseCase } from './application/create-template.use-case';
import { CreateTemplateVersionUseCase } from './application/create-template-version.use-case';
import { PlayerAssessmentLookupService } from './application/player-assessment-lookup.service';
import { PlayerAssessmentQueryService } from './application/player-assessment-query.service';
import { PublishPlayerAssessmentUseCase } from './application/publish-player-assessment.use-case';
import { PublishTemplateUseCase } from './application/publish-template.use-case';
import { ReviewPlayerAssessmentUseCase } from './application/review-player-assessment.use-case';
import { SubmitPlayerAssessmentUseCase } from './application/submit-player-assessment.use-case';
import { UpdatePlayerAssessmentUseCase } from './application/update-player-assessment.use-case';
import { AssessmentCatalogRepository } from './infrastructure/assessment-catalog.repository';
import { AssessmentDashboardRepository } from './infrastructure/assessment-dashboard.repository';
import { AssessmentScopeRepository } from './infrastructure/assessment-scope.repository';
import { PlayerAssessmentRepository } from './infrastructure/player-assessment.repository';

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
    PlayerAssessmentController,
    PlayerAssessmentSelfController,
  ],
  providers: [
    AssessmentDashboardRepository,
    AssessmentDashboardSignalsService,
    AssessmentCatalogRepository,
    AssessmentScopeRepository,
    PlayerAssessmentRepository,
    AssessmentScopeService,
    AssessmentQueryService,
    PlayerAssessmentQueryService,
    PlayerAssessmentLookupService,
    CreateMetricUseCase,
    CreateMetricVersionUseCase,
    ArchiveMetricUseCase,
    CreateTemplateUseCase,
    CreateTemplateVersionUseCase,
    PublishTemplateUseCase,
    CreatePeriodUseCase,
    CreatePlayerAssessmentUseCase,
    UpdatePlayerAssessmentUseCase,
    SubmitPlayerAssessmentUseCase,
    ReviewPlayerAssessmentUseCase,
    PublishPlayerAssessmentUseCase,
    CorrectPlayerAssessmentUseCase,
  ],
  exports: [AssessmentDashboardSignalsService],
})
export class AssessmentsModule {}
