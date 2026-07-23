import { ClockModule } from '@core/clock/clock.module';
import { IdGeneratorModule } from '@core/id-generator/id-generator.module';
import { PlatformModule } from '@modules/platform';
import { RbacModule } from '@modules/rbac';
import { Module } from '@nestjs/common';

import { AnalyticsController } from './api/analytics.controller';
import { AnalyticsAuthorityService } from './application/analytics-authority.service';
import { AnalyticsScopeService } from './application/analytics-scope.service';
import { AnalyticsSeriesService } from './application/analytics-series.service';
import { CohortComparisonService } from './application/cohort-comparison.service';
import { RebuildAnalyticsUseCase } from './application/rebuild-analytics.use-case';
import { AnalyticsFactRepository } from './infrastructure/analytics-fact.repository';
import { ProjectionRepository } from './infrastructure/projection.repository';

/**
 * Player, team, season, and cohort analytics (UN-700). Owns its persistence (raw
 * SQL via the global UnitOfWorkPort) and composes the platform audit primitive.
 *
 * Three invariants shape the module. Analytics cite FACTS, freshness, and a
 * calculation version — never an unversioned number. Null-not-zero holds end to
 * end: an unevaluated value is stored and surfaced as a NULL gap, while every
 * zero-contribution member is still projected so completeness is honest. Small
 * cohorts are SUPPRESSED below the privacy threshold, and correlation is exposed
 * as descriptive statistics only, never framed as causation.
 */
@Module({
  imports: [ClockModule, IdGeneratorModule, PlatformModule, RbacModule],
  controllers: [AnalyticsController],
  providers: [
    ProjectionRepository,
    AnalyticsFactRepository,
    AnalyticsAuthorityService,
    AnalyticsScopeService,
    AnalyticsSeriesService,
    CohortComparisonService,
    RebuildAnalyticsUseCase,
  ],
})
export class AnalyticsModule {}
