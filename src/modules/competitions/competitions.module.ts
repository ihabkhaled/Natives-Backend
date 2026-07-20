import { ClockModule } from '@core/clock/clock.module';
import { IdGeneratorModule } from '@core/id-generator/id-generator.module';
import { PlatformModule } from '@modules/platform';
import { Module } from '@nestjs/common';

import { CompetitionStructureController } from './api/competition-structure.controller';
import { CompetitionsController } from './api/competitions.controller';
import { FixturesController } from './api/fixtures.controller';
import { OpponentsController } from './api/opponents.controller';
import { CompetitionLookupService } from './application/competition-lookup.service';
import { CompetitionQueryService } from './application/competition-query.service';
import { CompetitionScopeService } from './application/competition-scope.service';
import { CreateCompetitionUseCase } from './application/create-competition.use-case';
import { CreateFixtureUseCase } from './application/create-fixture.use-case';
import { CreateOpponentUseCase } from './application/create-opponent.use-case';
import { CreateRoundUseCase } from './application/create-round.use-case';
import { CreateStageUseCase } from './application/create-stage.use-case';
import { FixtureLinkageService } from './application/fixture-linkage.service';
import { FixtureLookupService } from './application/fixture-lookup.service';
import { FixtureQueryService } from './application/fixture-query.service';
import { OpponentQueryService } from './application/opponent-query.service';
import { RescheduleFixtureUseCase } from './application/reschedule-fixture.use-case';
import { StructureQueryService } from './application/structure-query.service';
import { TransitionCompetitionUseCase } from './application/transition-competition.use-case';
import { TransitionFixtureUseCase } from './application/transition-fixture.use-case';
import { CompetitionRepository } from './infrastructure/competition.repository';
import { CompetitionScopeRepository } from './infrastructure/competition-scope.repository';
import { FixtureRepository } from './infrastructure/fixture.repository';
import { OpponentRepository } from './infrastructure/opponent.repository';
import { StageRepository } from './infrastructure/stage.repository';

/**
 * Competitions (UN-500): leagues, custom championships, tournaments, and
 * friendlies per team + season, their stages and rounds, the opponent catalogue,
 * and the fixture schedule shell. Owns its persistence (raw SQL via the global
 * UnitOfWorkPort) and composes the platform audit + outbox primitives so every
 * write commits atomically with its `competition.*` / `fixture.*` events. Squads,
 * rosters, and match play are later prompts and are not built here.
 */
@Module({
  imports: [ClockModule, IdGeneratorModule, PlatformModule],
  controllers: [
    CompetitionsController,
    CompetitionStructureController,
    OpponentsController,
    FixturesController,
  ],
  providers: [
    CompetitionScopeRepository,
    CompetitionRepository,
    StageRepository,
    OpponentRepository,
    FixtureRepository,
    CompetitionScopeService,
    CompetitionLookupService,
    CompetitionQueryService,
    CreateCompetitionUseCase,
    TransitionCompetitionUseCase,
    CreateStageUseCase,
    CreateRoundUseCase,
    StructureQueryService,
    CreateOpponentUseCase,
    OpponentQueryService,
    FixtureLinkageService,
    FixtureLookupService,
    FixtureQueryService,
    CreateFixtureUseCase,
    RescheduleFixtureUseCase,
    TransitionFixtureUseCase,
  ],
})
export class CompetitionsModule {}
