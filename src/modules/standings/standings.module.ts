import { ClockModule } from '@core/clock/clock.module';
import { IdGeneratorModule } from '@core/id-generator/id-generator.module';
import { PlatformModule } from '@modules/platform';
import { Module } from '@nestjs/common';

import { AchievementsController } from './api/achievements.controller';
import { StandingsController } from './api/standings.controller';
import { StandingsRulesController } from './api/standings-rules.controller';
import { TeamHistoryController } from './api/team-history.controller';
import { AchievementQueryService } from './application/achievement-query.service';
import { CreateAchievementUseCase } from './application/create-achievement.use-case';
import { CreateStandingsRuleUseCase } from './application/create-standings-rule.use-case';
import { ImportAchievementsUseCase } from './application/import-achievements.use-case';
import { RecomputeStandingsUseCase } from './application/recompute-standings.use-case';
import { RecordManualStandingUseCase } from './application/record-manual-standing.use-case';
import { StandingsQueryService } from './application/standings-query.service';
import { StandingsRuleService } from './application/standings-rule.service';
import { StandingsScopeService } from './application/standings-scope.service';
import { TransitionAchievementUseCase } from './application/transition-achievement.use-case';
import { AchievementRepository } from './infrastructure/achievement.repository';
import { StandingRepository } from './infrastructure/standing.repository';
import { StandingsRuleRepository } from './infrastructure/standings-rule.repository';
import { StandingsScopeRepository } from './infrastructure/standings-scope.repository';

/**
 * Standings, results, achievements, and team history (UN-506). Owns its
 * persistence (raw SQL via the global UnitOfWorkPort) and composes the platform
 * audit + outbox primitives so every write commits atomically with its events.
 *
 * Two invariants shape the module. Standings are DETERMINISTIC PER RULE VERSION:
 * rule versions are immutable, every stored row cites the version it was
 * computed under, and reading an old table re-sorts it by that version, never by
 * a newer one. History has PROVENANCE: a row is either derived from our own
 * finalized matches or carries an explicit source and reconciliation note, and
 * an achievement only becomes history after a human approves it.
 */
@Module({
  imports: [ClockModule, IdGeneratorModule, PlatformModule],
  controllers: [
    StandingsRulesController,
    StandingsController,
    AchievementsController,
    TeamHistoryController,
  ],
  providers: [
    StandingsScopeRepository,
    StandingsRuleRepository,
    StandingRepository,
    AchievementRepository,
    StandingsScopeService,
    StandingsRuleService,
    StandingsQueryService,
    AchievementQueryService,
    CreateStandingsRuleUseCase,
    RecomputeStandingsUseCase,
    RecordManualStandingUseCase,
    CreateAchievementUseCase,
    TransitionAchievementUseCase,
    ImportAchievementsUseCase,
  ],
})
export class StandingsModule {}
