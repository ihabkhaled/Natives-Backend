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
import { Inject, Injectable } from '@nestjs/common';

import { canPublishFeedback } from '../domain/feedback.state-machine';
import { FeedbackInvalidTransitionError } from '../errors/feedback-invalid-transition.error';
import { FeedbackVersionConflictError } from '../errors/feedback-version-conflict.error';
import { CoachFeedbackRepository } from '../infrastructure/coach-feedback.repository';
import {
  buildFeedbackAudit,
  buildFeedbackPublishedEvent,
  buildPublishTransition,
} from '../lib/feedback.builders';
import { FEEDBACK_PUBLISHED_ACTION } from '../model/development.constants';
import type {
  CoachFeedback,
  CoachFeedbackDetail,
  FeedbackVersionCommand,
} from '../model/feedback.types';
import { FeedbackLookupService } from './feedback-lookup.service';

/**
 * Publishes an IN_REVIEW feedback, sharing it with the member as the immutable,
 * player-visible result. Transitions under optimistic concurrency and enqueues a
 * privacy-safe `development.feedback.published` event (identifiers only — never
 * the coach note or any field text) atomically.
 */
@Injectable()
export class PublishFeedbackUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    private readonly lookup: FeedbackLookupService,
    private readonly repository: CoachFeedbackRepository,
    private readonly audit: AuditRecorderService,
    private readonly events: RecordDomainEventService,
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
    if (!canPublishFeedback(current.status)) {
      throw new FeedbackInvalidTransitionError();
    }
    const published = await this.transition(
      tx,
      teamId,
      feedbackId,
      command,
      actor,
    );
    return this.finish(tx, actor, published);
  }

  private async transition(
    tx: TransactionScope,
    teamId: string,
    feedbackId: string,
    command: FeedbackVersionCommand,
    actor: AuthUserIdentity,
  ): Promise<CoachFeedback> {
    const published = await this.repository.applyTransition(
      tx,
      buildPublishTransition(
        feedbackId,
        teamId,
        command.expectedRecordVersion,
        actor.userId,
        this.clock.now(),
      ),
    );
    if (published === null) {
      throw new FeedbackVersionConflictError();
    }
    return published;
  }

  private async finish(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    published: CoachFeedback,
  ): Promise<CoachFeedbackDetail> {
    await this.audit.record(
      tx,
      buildFeedbackAudit(FEEDBACK_PUBLISHED_ACTION, actor.userId, published),
    );
    await this.events.enqueue(tx, buildFeedbackPublishedEvent(published));
    return { feedback: published, acknowledgement: null };
  }
}
