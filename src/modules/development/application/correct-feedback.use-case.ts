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

import { canCorrectFeedback } from '../domain/feedback.state-machine';
import { FeedbackInvalidTransitionError } from '../errors/feedback-invalid-transition.error';
import { CoachFeedbackRepository } from '../infrastructure/coach-feedback.repository';
import {
  buildCorrectionFeedback,
  buildFeedbackAudit,
  buildFeedbackRevisedEvent,
  buildFeedbackSupersede,
} from '../lib/feedback.builders';
import { FEEDBACK_REVISED_ACTION } from '../model/development.constants';
import type {
  CoachFeedback,
  CoachFeedbackDetail,
  CorrectFeedbackCommand,
} from '../model/feedback.types';
import { FeedbackLookupService } from './feedback-lookup.service';

/**
 * Corrects a PUBLISHED (or already-revised) feedback. The published snapshot is
 * IMMUTABLE — this never edits it in place. It supersedes the prior row and
 * inserts a new REVISED revision (same family, revision + 1) carrying the
 * corrected fields, then enqueues a privacy-safe `development.feedback.revised`
 * event. All in one transaction.
 */
@Injectable()
export class CorrectFeedbackUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR_PORT) private readonly idGenerator: IdGeneratorPort,
    private readonly lookup: FeedbackLookupService,
    private readonly repository: CoachFeedbackRepository,
    private readonly audit: AuditRecorderService,
    private readonly events: RecordDomainEventService,
  ) {}

  execute(
    actor: AuthUserIdentity,
    teamId: string,
    feedbackId: string,
    command: CorrectFeedbackCommand,
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
    command: CorrectFeedbackCommand,
  ): Promise<CoachFeedbackDetail> {
    const previous = await this.lookup.requireForWrite(tx, teamId, feedbackId);
    if (
      !canCorrectFeedback(previous.status) ||
      previous.supersededAt !== null
    ) {
      throw new FeedbackInvalidTransitionError();
    }
    const revision = await this.supersedeAndInsert(
      tx,
      actor,
      previous,
      command,
    );
    return this.finish(tx, actor, previous, revision);
  }

  private async supersedeAndInsert(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    previous: CoachFeedback,
    command: CorrectFeedbackCommand,
  ): Promise<CoachFeedback> {
    const newId = this.idGenerator.generate();
    const now = this.clock.now();
    const superseded = await this.repository.supersede(
      tx,
      buildFeedbackSupersede(previous.id, newId, now),
    );
    if (!superseded) {
      throw new FeedbackInvalidTransitionError();
    }
    return this.repository.insertFeedback(
      tx,
      buildCorrectionFeedback(
        newId,
        previous,
        command.fields,
        actor.userId,
        now,
      ),
    );
  }

  private async finish(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    previous: CoachFeedback,
    revision: CoachFeedback,
  ): Promise<CoachFeedbackDetail> {
    await this.audit.record(
      tx,
      buildFeedbackAudit(FEEDBACK_REVISED_ACTION, actor.userId, revision),
    );
    await this.events.enqueue(
      tx,
      buildFeedbackRevisedEvent(revision, previous.id),
    );
    return { feedback: revision, acknowledgement: null };
  }
}
