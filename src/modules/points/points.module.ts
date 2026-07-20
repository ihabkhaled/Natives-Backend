import { ClockModule } from '@core/clock/clock.module';
import { IdGeneratorModule } from '@core/id-generator/id-generator.module';
import { PlatformModule } from '@modules/platform';
import { Module } from '@nestjs/common';

import { PointsController } from './api/points.controller';
import { PointsRuleController } from './api/points-rule.controller';
import { PointsSelfController } from './api/points-self.controller';
import { AwardActivityPointsService } from './application/award-activity-points.service';
import { BadgeSyncService } from './application/badge-sync.service';
import { CreateAdjustmentUseCase } from './application/create-adjustment.use-case';
import { CreatePointsRuleUseCase } from './application/create-points-rule.use-case';
import { LeaderboardDataService } from './application/leaderboard-data.service';
import { LeaderboardQueryService } from './application/leaderboard-query.service';
import { PointsDashboardSignalsService } from './application/points-dashboard-signals.service';
import { PointsQueryService } from './application/points-query.service';
import { PointsScopeService } from './application/points-scope.service';
import { PointsSummaryService } from './application/points-summary.service';
import { ReverseActivityPointsService } from './application/reverse-activity-points.service';
import { RuleLookupService } from './application/rule-lookup.service';
import { RuleQueryService } from './application/rule-query.service';
import { TransitionPointsRuleUseCase } from './application/transition-points-rule.use-case';
import { BadgeRepository } from './infrastructure/badge.repository';
import { LeaderboardRepository } from './infrastructure/leaderboard.repository';
import { PointsDashboardRepository } from './infrastructure/points-dashboard.repository';
import { PointsLedgerRepository } from './infrastructure/points-ledger.repository';
import { PointsRuleRepository } from './infrastructure/points-rule.repository';
import { PointsScopeRepository } from './infrastructure/points-scope.repository';

/**
 * Append-only points system (UN-402). Awards points for approved activity claims
 * through one atomic idempotent service (per the single PUBLISHED rule version,
 * with per-category caps and cooldowns), compensates corrections with negative
 * REVERSAL rows (never edits), records audited manual adjustments, and awards badge
 * tiers when a member crosses a threshold. Totals are always ledger projections —
 * never stored counters — and the ledger is UPDATE/DELETE-guarded in the database.
 * Owns its persistence (raw SQL via the global UnitOfWorkPort) and composes the
 * platform audit + outbox primitives so every write commits atomically. Exports the
 * award/reversal services the activities review flow invokes inside its transaction.
 */
@Module({
  imports: [ClockModule, IdGeneratorModule, PlatformModule],
  controllers: [PointsController, PointsSelfController, PointsRuleController],
  providers: [
    PointsDashboardRepository,
    PointsDashboardSignalsService,
    PointsScopeRepository,
    PointsRuleRepository,
    PointsLedgerRepository,
    LeaderboardRepository,
    BadgeRepository,
    PointsScopeService,
    BadgeSyncService,
    AwardActivityPointsService,
    ReverseActivityPointsService,
    PointsSummaryService,
    PointsQueryService,
    LeaderboardDataService,
    LeaderboardQueryService,
    RuleLookupService,
    RuleQueryService,
    CreateAdjustmentUseCase,
    CreatePointsRuleUseCase,
    TransitionPointsRuleUseCase,
  ],
  exports: [
    AwardActivityPointsService,
    ReverseActivityPointsService,
    PointsDashboardSignalsService,
  ],
})
export class PointsModule {}
