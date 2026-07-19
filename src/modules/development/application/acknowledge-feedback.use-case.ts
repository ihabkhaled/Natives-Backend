import type { AuthUserIdentity } from '@core/auth';
import { CLOCK_PORT, type ClockPort } from '@core/clock/clock.port';
import {
  ID_GENERATOR_PORT,
  type IdGeneratorPort,
} from '@core/id-generator/id-generator.port';
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

import { CoachFeedbackNotFoundError } from '../errors/coach-feedback-not-found.error';
import { FeedbackAlreadyAcknowledgedError } from '../errors/feedback-already-acknowledged.error';
import { CoachFeedbackRepository } from '../infrastructure/coach-feedback.repository';
import {
  buildFeedbackAcknowledgedEvent,
  buildFeedbackAudit,
  buildNewAcknowledgement,
} from '../lib/feedback.builders';
import { FEEDBACK_ACKNOWLEDGED_ACTION } from '../model/development.constants';
import type {
  AcknowledgeFeedbackCommand,
  CoachFeedback,
  FeedbackAcknowledgement,
} from '../model/feedback.types';

/**
 * Records a member's acknowledgement of feedback shared WITH them, optionally
 * requesting clarification. Ownership is resolved from the authenticated identity
 * against the membership — a member can only acknowledge their own published
 * feedback; anything else is a 404. One acknowledgement per feedback is enforced.
 * Enqueues a privacy-safe acknowledgement/clarification event.
 */
@Injectable()
export class AcknowledgeFeedbackUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR_PORT) private readonly idGenerator: IdGeneratorPort,
    private readonly repository: CoachFeedbackRepository,
    private readonly audit: AuditRecorderService,
    private readonly events: RecordDomainEventService,
  ) {}

  execute(
    actor: AuthUserIdentity,
    teamId: string,
    feedbackId: string,
    command: AcknowledgeFeedbackCommand,
  ): Promise<FeedbackAcknowledgement> {
    return this.unitOfWork.runInTransaction(tx =>
      this.run(tx, actor, teamId, feedbackId, command),
    );
  }

  private async run(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    feedbackId: string,
    command: AcknowledgeFeedbackCommand,
  ): Promise<FeedbackAcknowledgement> {
    const feedback = await this.repository.findOwnedShared(
      tx,
      teamId,
      feedbackId,
      actor.userId,
    );
    if (feedback === null) {
      throw new CoachFeedbackNotFoundError();
    }
    await this.assertNotAcknowledged(tx, feedbackId);
    return this.record(tx, actor, feedback, command);
  }

  private async assertNotAcknowledged(
    tx: TransactionScope,
    feedbackId: string,
  ): Promise<void> {
    const existing = await this.repository.findAcknowledgement(tx, feedbackId);
    if (existing !== null) {
      throw new FeedbackAlreadyAcknowledgedError();
    }
  }

  private async record(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    feedback: CoachFeedback,
    command: AcknowledgeFeedbackCommand,
  ): Promise<FeedbackAcknowledgement> {
    const acknowledgement = await this.repository.insertAcknowledgement(
      tx,
      buildNewAcknowledgement(
        this.idGenerator.generate(),
        feedback,
        actor.userId,
        command,
        this.clock.now(),
      ),
    );
    await this.audit.record(
      tx,
      buildFeedbackAudit(FEEDBACK_ACKNOWLEDGED_ACTION, actor.userId, feedback),
    );
    await this.events.enqueue(
      tx,
      buildFeedbackAcknowledgedEvent(feedback, acknowledgement),
    );
    return acknowledgement;
  }
}
