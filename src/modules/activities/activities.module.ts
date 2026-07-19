import { ClockModule } from '@core/clock/clock.module';
import { IdGeneratorModule } from '@core/id-generator/id-generator.module';
import { PlatformModule } from '@modules/platform';
import { PointsModule } from '@modules/points';
import { Module } from '@nestjs/common';

import { ActivityBuddyController } from './api/activity-buddy.controller';
import { ActivityEvidenceController } from './api/activity-evidence.controller';
import { ActivityReviewController } from './api/activity-review.controller';
import { ActivitySubmissionController } from './api/activity-submission.controller';
import { ActivityTypeController } from './api/activity-type.controller';
import { ActivityCatalogService } from './application/activity-catalog.service';
import { ActivityScopeService } from './application/activity-scope.service';
import { BuddyQueryService } from './application/buddy-query.service';
import { ClaimReviewUseCase } from './application/claim-review.use-case';
import { CorrectSubmissionUseCase } from './application/correct-submission.use-case';
import { CreateSubmissionUseCase } from './application/create-submission.use-case';
import { EvidenceQueryService } from './application/evidence-query.service';
import { RecordReviewDecisionUseCase } from './application/record-review-decision.use-case';
import { RespondToBuddyUseCase } from './application/respond-to-buddy.use-case';
import { ReviewDetailService } from './application/review-detail.service';
import { ReviewEligibilityService } from './application/review-eligibility.service';
import { ReviewQueueService } from './application/review-queue.service';
import { SubmissionLookupService } from './application/submission-lookup.service';
import { SubmissionQueryService } from './application/submission-query.service';
import { SubmitSubmissionUseCase } from './application/submit-submission.use-case';
import { UpdateSubmissionUseCase } from './application/update-submission.use-case';
import { WithdrawSubmissionUseCase } from './application/withdraw-submission.use-case';
import { ActivityBuddyRepository } from './infrastructure/activity-buddy.repository';
import { ActivityEvidenceRepository } from './infrastructure/activity-evidence.repository';
import { ActivityReviewRepository } from './infrastructure/activity-review.repository';
import { ActivityScopeRepository } from './infrastructure/activity-scope.repository';
import { ActivitySubmissionRepository } from './infrastructure/activity-submission.repository';
import { ActivityTypeRepository } from './infrastructure/activity-type.repository';

/**
 * External training bounded context (UN-400): the versioned activity-type catalog
 * (point-value candidates; WFDF/custom pending), member submissions with the
 * draft → submitted → changes_requested → resubmit / withdraw lifecycle, private
 * reviewer-only evidence, and training buddies that each confirm or decline their
 * credit. Owns its persistence (raw SQL via the global UnitOfWorkPort) and composes
 * the platform audit + outbox primitives so every write and its ActivitySubmitted /
 * ActivityWithdrawn event commit atomically. Review/moderation is prompt 401.
 */
@Module({
  imports: [ClockModule, IdGeneratorModule, PlatformModule, PointsModule],
  controllers: [
    ActivityTypeController,
    ActivitySubmissionController,
    ActivityEvidenceController,
    ActivityBuddyController,
    ActivityReviewController,
  ],
  providers: [
    ActivityScopeRepository,
    ActivityTypeRepository,
    ActivitySubmissionRepository,
    ActivityEvidenceRepository,
    ActivityBuddyRepository,
    ActivityReviewRepository,
    ActivityScopeService,
    ActivityCatalogService,
    SubmissionLookupService,
    SubmissionQueryService,
    EvidenceQueryService,
    BuddyQueryService,
    ReviewEligibilityService,
    ReviewDetailService,
    ReviewQueueService,
    CreateSubmissionUseCase,
    UpdateSubmissionUseCase,
    SubmitSubmissionUseCase,
    WithdrawSubmissionUseCase,
    RespondToBuddyUseCase,
    ClaimReviewUseCase,
    RecordReviewDecisionUseCase,
    CorrectSubmissionUseCase,
  ],
})
export class ActivitiesModule {}
