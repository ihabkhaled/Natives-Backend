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
import { AwardActivityPointsService } from '@modules/points';
import { Inject, Injectable } from '@nestjs/common';

import {
  assertReviewNote,
  resolveDecisionStatus,
} from '../domain/activity-review.policy';
import { canTransitionSubmission } from '../domain/activity-submission.state-machine';
import { ActivityInvalidTransitionError } from '../errors/activity-invalid-transition.error';
import { ActivityVersionConflictError } from '../errors/activity-version-conflict.error';
import { ActivityReviewRepository } from '../infrastructure/activity-review.repository';
import {
  buildReviewDecisionChange,
  buildReviewOutcomeEvent,
  buildSubmissionAudit,
  resolveReviewDecisionEvent,
} from '../lib/activity.builders';
import { REVIEW_DECIDED_ACTION } from '../model/activities.constants';
import { SubmissionStatus } from '../model/activity.enums';
import type {
  ActivitySubmission,
  ReviewDecisionCommand,
} from '../model/activity.types';
import type { ReviewDetailView } from '../model/activity.views';
import { ReviewDetailService } from './review-detail.service';
import { ReviewEligibilityService } from './review-eligibility.service';

/**
 * Records a reviewer's moderation decision (approve / reject / request-changes)
 * with the structured reviewer note. Self-review and buddy-review are forbidden
 * (403); denial decisions require a note; the optimistic transition, its audit,
 * and the versioned privacy-safe outbox event commit in one transaction.
 */
@Injectable()
export class RecordReviewDecisionUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    private readonly eligibility: ReviewEligibilityService,
    private readonly review: ActivityReviewRepository,
    private readonly detail: ReviewDetailService,
    private readonly audit: AuditRecorderService,
    private readonly events: RecordDomainEventService,
    private readonly award: AwardActivityPointsService,
  ) {}

  execute(
    actor: AuthUserIdentity,
    teamId: string,
    submissionId: string,
    command: ReviewDecisionCommand,
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
    command: ReviewDecisionCommand,
  ): Promise<ReviewDetailView> {
    const current = await this.eligibility.requireEligible(
      tx,
      teamId,
      submissionId,
      actor.userId,
    );
    assertReviewNote(command.decision, command.reviewNote);
    const target = resolveDecisionStatus(command.decision);
    if (!canTransitionSubmission(current.status, target)) {
      throw new ActivityInvalidTransitionError();
    }
    const decided = await this.decide(tx, actor, current, command, target);
    return this.finish(tx, actor, decided, command);
  }

  private async decide(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    current: ActivitySubmission,
    command: ReviewDecisionCommand,
    target: SubmissionStatus,
  ): Promise<ActivitySubmission> {
    const decided = await this.review.applyDecision(
      tx,
      buildReviewDecisionChange(
        current.id,
        current.teamId,
        command.expectedRecordVersion,
        target,
        command.reviewNote,
        actor.userId,
        this.clock.now(),
      ),
    );
    if (decided === null) {
      throw new ActivityVersionConflictError();
    }
    return decided;
  }

  private async finish(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    decided: ActivitySubmission,
    command: ReviewDecisionCommand,
  ): Promise<ReviewDetailView> {
    await this.audit.record(
      tx,
      buildSubmissionAudit(REVIEW_DECIDED_ACTION, actor.userId, decided),
    );
    await this.events.enqueue(
      tx,
      buildReviewOutcomeEvent(
        decided,
        resolveReviewDecisionEvent(command.decision),
        actor.userId,
      ),
    );
    await this.maybeAward(tx, actor, decided);
    return this.detail.assembleDetail(tx, decided);
  }

  private async maybeAward(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    decided: ActivitySubmission,
  ): Promise<void> {
    if (decided.status !== SubmissionStatus.Approved) {
      return;
    }
    await this.award.awardForApproval(tx, {
      submissionId: decided.id,
      teamId: decided.teamId,
      seasonId: decided.seasonId,
      membershipId: decided.membershipId,
      activityTypeId: decided.activityTypeId,
      performedOn: decided.performedOn,
      actorUserId: actor.userId,
    });
  }
}
