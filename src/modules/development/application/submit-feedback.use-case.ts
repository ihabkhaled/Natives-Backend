import type { AuthUserIdentity } from '@core/auth';
import { CLOCK_PORT, type ClockPort } from '@core/clock/clock.port';
import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { AuditRecorderService } from '@modules/platform';
import { Inject, Injectable } from '@nestjs/common';

import { canTransitionFeedback } from '../domain/feedback.state-machine';
import { FeedbackInvalidTransitionError } from '../errors/feedback-invalid-transition.error';
import { FeedbackVersionConflictError } from '../errors/feedback-version-conflict.error';
import { CoachFeedbackRepository } from '../infrastructure/coach-feedback.repository';
import {
  buildFeedbackAudit,
  buildSubmitTransition,
} from '../lib/feedback.builders';
import { FEEDBACK_SUBMITTED_ACTION } from '../model/development.constants';
import { FeedbackStatus } from '../model/feedback.enums';
import type {
  CoachFeedback,
  CoachFeedbackDetail,
  FeedbackVersionCommand,
} from '../model/feedback.types';
import { FeedbackLookupService } from './feedback-lookup.service';

/**
 * Submits a DRAFT feedback into review (DRAFT → IN_REVIEW). Only the authoring
 * coach may submit; the transition is optimistic and audited. Submission never
 * exposes the record to the member — only publishing shares it.
 */
@Injectable()
export class SubmitFeedbackUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    private readonly lookup: FeedbackLookupService,
    private readonly repository: CoachFeedbackRepository,
    private readonly audit: AuditRecorderService,
  ) {}

  execute(
    actor: AuthUserIdentity,
    teamId: string,
    feedbackId: string,
    command: FeedbackVersionCommand,
  ): Promise<CoachFeedbackDetail> {
    return this.unitOfWork.runInTransaction(tx =>
      this.run(tx, actor, teamId, feedbackId, command),
    );
  }

  private async run(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    feedbackId: string,
    command: FeedbackVersionCommand,
  ): Promise<CoachFeedbackDetail> {
    const current = await this.lookup.requireForWrite(tx, teamId, feedbackId);
    this.lookup.requireAuthor(current, actor.userId);
    if (!canTransitionFeedback(current.status, FeedbackStatus.InReview)) {
      throw new FeedbackInvalidTransitionError();
    }
    const submitted = await this.transition(
      tx,
      teamId,
      feedbackId,
      command,
      actor,
    );
    await this.audit.record(
      tx,
      buildFeedbackAudit(FEEDBACK_SUBMITTED_ACTION, actor.userId, submitted),
    );
    return { feedback: submitted, acknowledgement: null };
  }

  private async transition(
    tx: TransactionScope,
    teamId: string,
    feedbackId: string,
    command: FeedbackVersionCommand,
    actor: AuthUserIdentity,
  ): Promise<CoachFeedback> {
    const submitted = await this.repository.applyTransition(
      tx,
      buildSubmitTransition(
        feedbackId,
        teamId,
        command.expectedRecordVersion,
        actor.userId,
        this.clock.now(),
      ),
    );
    if (submitted === null) {
      throw new FeedbackVersionConflictError();
    }
    return submitted;
  }
}
