import { ClockModule } from '@core/clock/clock.module';
import { IdGeneratorModule } from '@core/id-generator/id-generator.module';
import { PlatformModule } from '@modules/platform';
import { Module } from '@nestjs/common';

import { CalculationRuleController } from './api/calculation-rule.controller';
import { ScoreController } from './api/score.controller';
import { ScoreSelfController } from './api/score-self.controller';
import { CreateCalculationRuleUseCase } from './application/create-calculation-rule.use-case';
import { RebuildScoreProjectionsUseCase } from './application/rebuild-score-projections.use-case';
import { RuleLookupService } from './application/rule-lookup.service';
import { RuleQueryService } from './application/rule-query.service';
import { ScoreQueryService } from './application/score-query.service';
import { ScoringScopeService } from './application/scoring-scope.service';
import { SimulateCalculationRuleUseCase } from './application/simulate-calculation-rule.use-case';
import { TransitionCalculationRuleUseCase } from './application/transition-calculation-rule.use-case';
import { UpdateCalculationRuleUseCase } from './application/update-calculation-rule.use-case';
import { CalculationRuleRepository } from './infrastructure/calculation-rule.repository';
import { ScoreProjectionRepository } from './infrastructure/score-projection.repository';
import { ScoreSourceRepository } from './infrastructure/score-source.repository';
import { ScoringScopeRepository } from './infrastructure/scoring-scope.repository';

/**
 * Versioned performance score engine (UN-303). Named calculation-rule versions
 * move DRAFT → APPROVED → PUBLISHED → RETIRED; a pure deterministic engine
 * projects category and overall scores from source facts with a full explanation
 * (rule version, numerator/denominator, exclusions, unrounded + display,
 * confidence/completeness). Projections are rebuildable caches — never editable
 * totals — recomputed idempotently and signalled through the outbox. The legacy
 * equal-weight overall is a seeded DRAFT candidate, never hard-coded as final.
 * Owns its persistence (raw SQL via the global UnitOfWorkPort) and composes the
 * platform audit + outbox primitives so every write is recorded atomically.
 */
@Module({
  imports: [ClockModule, IdGeneratorModule, PlatformModule],
  controllers: [
    CalculationRuleController,
    ScoreController,
    ScoreSelfController,
  ],
  providers: [
    ScoringScopeRepository,
    CalculationRuleRepository,
    ScoreProjectionRepository,
    ScoreSourceRepository,
    ScoringScopeService,
    RuleLookupService,
    RuleQueryService,
    ScoreQueryService,
    CreateCalculationRuleUseCase,
    UpdateCalculationRuleUseCase,
    TransitionCalculationRuleUseCase,
    SimulateCalculationRuleUseCase,
    RebuildScoreProjectionsUseCase,
  ],
})
export class ScoringModule {}
