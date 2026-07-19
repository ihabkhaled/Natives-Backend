import type { AuthUserIdentity } from '@core/auth';
import { CLOCK_PORT, type ClockPort } from '@core/clock/clock.port';
import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { AuditRecorderService } from '@modules/platform';
import { Inject, Injectable } from '@nestjs/common';

import { canEditFeedbackDraft } from '../domain/feedback.state-machine';
import { FeedbackInvalidTransitionError } from '../errors/feedback-invalid-transition.error';
import { FeedbackVersionConflictError } from '../errors/feedback-version-conflict.error';
import { CoachFeedbackRepository } from '../infrastructure/coach-feedback.repository';
import { buildFeedbackAudit, buildNewFeedback } from '../lib/feedback.builders';
import { FEEDBACK_UPDATED_ACTION } from '../model/development.constants';
import type {
  CoachFeedback,
  CoachFeedbackDetail,
  UpdateFeedbackCommand,
} from '../model/feedback.types';
import { FeedbackLookupService } from './feedback-lookup.service';

/**
 * Autosaves a DRAFT feedback's structured fields (including the private coach
 * note). Only the authoring coach may edit; only a draft is editable. Applies the
 * write under optimistic concurrency and records an audit entry — all in one
 * transaction.
 */
@Injectable()
export class UpdateFeedbackUseCase {
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
    command: UpdateFeedbackCommand,
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
    command: UpdateFeedbackCommand,
  ): Promise<CoachFeedbackDetail> {
    const current = await this.lookup.requireForWrite(tx, teamId, feedbackId);
    this.lookup.requireAuthor(current, actor.userId);
    if (!canEditFeedbackDraft(current.status)) {
      throw new FeedbackInvalidTransitionError();
    }
    const updated = await this.persist(tx, current, feedbackId, command);
    await this.audit.record(
      tx,
      buildFeedbackAudit(FEEDBACK_UPDATED_ACTION, actor.userId, updated),
    );
    return { feedback: updated, acknowledgement: null };
  }

  private async persist(
    tx: TransactionScope,
    current: CoachFeedback,
    feedbackId: string,
    command: UpdateFeedbackCommand,
  ): Promise<CoachFeedback> {
    const draft = buildNewFeedback(
      feedbackId,
      current.teamId,
      {
        membershipId: current.membershipId,
        seasonId: current.seasonId,
        fields: command.fields,
      },
      current.authorUserId,
      this.clock.now(),
    );
    const updated = await this.repository.updateDraftFields(
      tx,
      draft,
      feedbackId,
      command.expectedRecordVersion,
    );
    if (updated === null) {
      throw new FeedbackVersionConflictError();
    }
    return updated;
  }
}
