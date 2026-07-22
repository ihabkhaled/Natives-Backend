import { ClockModule } from '@core/clock/clock.module';
import { IdGeneratorModule } from '@core/id-generator/id-generator.module';
import { PlatformModule } from '@modules/platform';
import { RbacModule } from '@modules/rbac';
import { Module } from '@nestjs/common';

import { TryoutCandidatesController } from './api/tryout-candidates.controller';
import { TryoutEventsController } from './api/tryout-events.controller';
import { ConvertCandidateUseCase } from './application/convert-candidate.use-case';
import { ManageCandidateUseCase } from './application/manage-candidate.use-case';
import { ManageOfferUseCase } from './application/manage-offer.use-case';
import { ManageTryoutEventUseCase } from './application/manage-tryout-event.use-case';
import { RecordDecisionUseCase } from './application/record-decision.use-case';
import { RegisterCandidateUseCase } from './application/register-candidate.use-case';
import { SubmitEvaluationUseCase } from './application/submit-evaluation.use-case';
import { TryoutFunnelService } from './application/tryout-funnel.service';
import { TryoutLookupService } from './application/tryout-lookup.service';
import { TryoutQueryService } from './application/tryout-query.service';
import { TryoutCandidateRepository } from './infrastructure/tryout-candidate.repository';
import { TryoutEventRepository } from './infrastructure/tryout-event.repository';
import { TryoutSelectionRepository } from './infrastructure/tryout-selection.repository';

/**
 * Tryouts (UN-600, UN-601): events, registration, consent, check-in,
 * evaluations, decisions, offers, and member conversion. Owns its persistence
 * (raw SQL via the global UnitOfWorkPort) and composes the platform audit +
 * outbox primitives so every write commits atomically with its `tryout.*`
 * events.
 *
 * Three invariants shape the module. A candidate is NOT a member until an
 * explicit, human-decided conversion runs exactly once. Only approved fields are
 * collected — there is no national-id column anywhere — and contact and health
 * data are redacted unless the caller holds the matching permission tier.
 * Automated aggregates summarise evaluators; they never decide acceptance.
 */
@Module({
  imports: [ClockModule, IdGeneratorModule, PlatformModule, RbacModule],
  controllers: [TryoutEventsController, TryoutCandidatesController],
  providers: [
    TryoutEventRepository,
    TryoutCandidateRepository,
    TryoutSelectionRepository,
    TryoutLookupService,
    TryoutQueryService,
    TryoutFunnelService,
    ManageTryoutEventUseCase,
    RegisterCandidateUseCase,
    ManageCandidateUseCase,
    SubmitEvaluationUseCase,
    RecordDecisionUseCase,
    ManageOfferUseCase,
    ConvertCandidateUseCase,
  ],
})
export class TryoutsModule {}
