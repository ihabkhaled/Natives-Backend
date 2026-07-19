import type { AuthUserIdentity } from '@core/auth';
import { CLOCK_PORT, type ClockPort } from '@core/clock/clock.port';
import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import {
  AuditRecorderService,
  RecordDomainEventService,
} from '@modules/platform';
import { ReverseActivityPointsService } from '@modules/points';
import { Inject, Injectable } from '@nestjs/common';

import { canReverseSubmission } from '../domain/activity-submission.state-machine';
import { ActivityInvalidTransitionError } from '../errors/activity-invalid-transition.error';
import { ActivityVersionConflictError } from '../errors/activity-version-conflict.error';
import { ActivityReviewRepository } from '../infrastructure/activity-review.repository';
import {
  buildActivityCorrectedEvent,
  buildReviewReversalChange,
  buildSubmissionAudit,
} from '../lib/activity.builders';
import { REVIEW_CORRECTED_ACTION } from '../model/activities.constants';
import type {
  ActivitySubmission,
  ReviewCorrectionCommand,
} from '../model/activity.types';
import type { ReviewDetailView } from '../model/activity.views';
import { ReviewDetailService } from './review-detail.service';
import { ReviewEligibilityService } from './review-eligibility.service';

/**
 * Corrects an already-approved claim through a compensating reversal
 * (approved → reversed) with a structured reason (activity.correct). The awarded
 * history is never rewritten — the actual points reversal is prompt 402; here the
 * reversal decision is recorded, audited, and published as ActivityCorrected in
 * one transaction. Self-review and buddy conflicts are forbidden (403).
 */
@Injectable()
export class CorrectSubmissionUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    private readonly eligibility: ReviewEligibilityService,
    private readonly review: ActivityReviewRepository,
    private readonly detail: ReviewDetailService,
    private readonly audit: AuditRecorderService,
    private readonly events: RecordDomainEventService,
    private readonly pointsReversal: ReverseActivityPointsService,
  ) {}

  execute(
    actor: AuthUserIdentity,
    teamId: string,
    submissionId: string,
    command: ReviewCorrectionCommand,
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
    command: ReviewCorrectionCommand,
  ): Promise<ReviewDetailView> {
    const current = await this.eligibility.requireEligible(
      tx,
      teamId,
      submissionId,
      actor.userId,
    );
    if (!canReverseSubmission(current.status)) {
      throw new ActivityInvalidTransitionError();
    }
    const reversed = await this.reverse(tx, actor, current, command);
    return this.finish(tx, actor, reversed);
  }

  private async reverse(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    current: ActivitySubmission,
    command: ReviewCorrectionCommand,
  ): Promise<ActivitySubmission> {
    const reversed = await this.review.applyReversal(
      tx,
      buildReviewReversalChange(
        current.id,
        current.teamId,
        command.expectedRecordVersion,
        command.reason,
        actor.userId,
        this.clock.now(),
      ),
    );
    if (reversed === null) {
      throw new ActivityVersionConflictError();
    }
    return reversed;
  }

  private async finish(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    reversed: ActivitySubmission,
  ): Promise<ReviewDetailView> {
    await this.audit.record(
      tx,
      buildSubmissionAudit(REVIEW_CORRECTED_ACTION, actor.userId, reversed),
    );
    await this.events.enqueue(
      tx,
      buildActivityCorrectedEvent(reversed, actor.userId),
    );
    await this.pointsReversal.reverseForCorrection(tx, {
      submissionId: reversed.id,
      teamId: reversed.teamId,
      membershipId: reversed.membershipId,
      actorUserId: actor.userId,
    });
    return this.detail.assembleDetail(tx, reversed);
  }
}
