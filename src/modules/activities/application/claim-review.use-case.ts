import type { AuthUserIdentity } from '@core/auth';
import { CLOCK_PORT, type ClockPort } from '@core/clock/clock.port';
import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { AuditRecorderService } from '@modules/platform';
import { Inject, Injectable } from '@nestjs/common';

import { canClaimForReview } from '../domain/activity-submission.state-machine';
import { ActivityInvalidTransitionError } from '../errors/activity-invalid-transition.error';
import { ActivityVersionConflictError } from '../errors/activity-version-conflict.error';
import { ActivityReviewRepository } from '../infrastructure/activity-review.repository';
import {
  buildReviewClaim,
  buildSubmissionAudit,
} from '../lib/activity.builders';
import { REVIEW_CLAIMED_ACTION } from '../model/activities.constants';
import type {
  ActivitySubmission,
  SubmissionVersionCommand,
} from '../model/activity.types';
import type { ReviewDetailView } from '../model/activity.views';
import { ReviewDetailService } from './review-detail.service';
import { ReviewEligibilityService } from './review-eligibility.service';

/**
 * A reviewer claims a submitted claim into review (submitted → under_review),
 * leasing it to themselves. Self-review and buddy-review are forbidden (403); the
 * optimistic transition is audited. No member-facing event fires — a lease is an
 * internal bookkeeping step, not a moderation outcome.
 */
@Injectable()
export class ClaimReviewUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    private readonly eligibility: ReviewEligibilityService,
    private readonly review: ActivityReviewRepository,
    private readonly detail: ReviewDetailService,
    private readonly audit: AuditRecorderService,
  ) {}

  execute(
    actor: AuthUserIdentity,
    teamId: string,
    submissionId: string,
    command: SubmissionVersionCommand,
  ): Promise<ReviewDetailView> {
    return this.unitOfWork.runInTransaction(tx =>
      this.run(tx, actor, teamId, submissionId, command),
    );
  }

  private async run(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    submissionId: string,
    command: SubmissionVersionCommand,
  ): Promise<ReviewDetailView> {
    const current = await this.eligibility.requireEligible(
      tx,
      teamId,
      submissionId,
      actor.userId,
    );
    if (!canClaimForReview(current.status)) {
      throw new ActivityInvalidTransitionError();
    }
    const claimed = await this.claim(tx, actor, current, command);
    await this.audit.record(
      tx,
      buildSubmissionAudit(REVIEW_CLAIMED_ACTION, actor.userId, claimed),
    );
    return this.detail.assembleDetail(tx, claimed);
  }

  private async claim(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    current: ActivitySubmission,
    command: SubmissionVersionCommand,
  ): Promise<ActivitySubmission> {
    const claimed = await this.review.claimForReview(
      tx,
      buildReviewClaim(
        current.id,
        current.teamId,
        command.expectedRecordVersion,
        actor.userId,
        this.clock.now(),
      ),
    );
    if (claimed === null) {
      throw new ActivityVersionConflictError();
    }
    return claimed;
  }
}
