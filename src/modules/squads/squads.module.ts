import { ClockModule } from '@core/clock/clock.module';
import { IdGeneratorModule } from '@core/id-generator/id-generator.module';
import { PlatformModule } from '@modules/platform';
import { Module } from '@nestjs/common';

import { SquadAvailabilityController } from './api/squad-availability.controller';
import { SquadSelectionsController } from './api/squad-selections.controller';
import { SquadsController } from './api/squads.controller';
import { AvailabilityQueryService } from './application/availability-query.service';
import { CreateSquadUseCase } from './application/create-squad.use-case';
import { DeclareAvailabilityUseCase } from './application/declare-availability.use-case';
import { EligibilityReportService } from './application/eligibility-report.service';
import { RemoveSelectionUseCase } from './application/remove-selection.use-case';
import { SelectPlayerUseCase } from './application/select-player.use-case';
import { SelectionQueryService } from './application/selection-query.service';
import { SquadLookupService } from './application/squad-lookup.service';
import { SquadQueryService } from './application/squad-query.service';
import { SquadScopeService } from './application/squad-scope.service';
import { TransitionSquadUseCase } from './application/transition-squad.use-case';
import { SquadRepository } from './infrastructure/squad.repository';
import { SquadAvailabilityRepository } from './infrastructure/squad-availability.repository';
import { SquadEligibilityRepository } from './infrastructure/squad-eligibility.repository';
import { SquadScopeRepository } from './infrastructure/squad-scope.repository';
import { SquadSelectionRepository } from './infrastructure/squad-selection.repository';

/**
 * Season squads (UN-501): a squad is the eligible player pool for a season and
 * optional competition. Owns its persistence (raw SQL via the global
 * UnitOfWorkPort) and composes the platform audit + outbox primitives so every
 * write commits atomically with its `squad.*` events. Eligibility signals are
 * computed and surfaced as advisory only — they never auto-select or exclude;
 * selecting a flagged player requires an explicit, audited human override. Match
 * rosters are a later prompt and are not built here.
 */
@Module({
  imports: [ClockModule, IdGeneratorModule, PlatformModule],
  controllers: [
    SquadsController,
    SquadSelectionsController,
    SquadAvailabilityController,
  ],
  providers: [
    SquadScopeRepository,
    SquadRepository,
    SquadSelectionRepository,
    SquadAvailabilityRepository,
    SquadEligibilityRepository,
    SquadScopeService,
    SquadLookupService,
    SquadQueryService,
    EligibilityReportService,
    AvailabilityQueryService,
    SelectionQueryService,
    CreateSquadUseCase,
    TransitionSquadUseCase,
    SelectPlayerUseCase,
    RemoveSelectionUseCase,
    DeclareAvailabilityUseCase,
  ],
})
export class SquadsModule {}
