import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import { toSharedFeedback } from '../domain/feedback-visibility.policy';
import { CoachFeedbackNotFoundError } from '../errors/coach-feedback-not-found.error';
import { CoachFeedbackRepository } from '../infrastructure/coach-feedback.repository';
import type { PageRequest } from '../model/development.types';
import type {
  CoachFeedbackDetail,
  FeedbackRevisionHistory,
  FeedbackSummaryPage,
  OwnFeedbackResult,
  SharedFeedbackPage,
} from '../model/feedback.types';

/**
 * Read side of coach feedback. Team reads (feedback.manage) see full detail
 * including the private coach note; the broad team list returns note-free
 * summaries only. The player self read (feedback.read.self) returns ONLY the
 * caller's own PUBLISHED/REVISED feedback, shaped to strip the coach note.
 */
@Injectable()
export class FeedbackQueryService {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    private readonly repository: CoachFeedbackRepository,
  ) {}

  listForTeam(teamId: string, page: PageRequest): Promise<FeedbackSummaryPage> {
    return this.unitOfWork.runInTransaction(tx =>
      this.teamPage(tx, teamId, page),
    );
  }

  getDetail(teamId: string, feedbackId: string): Promise<CoachFeedbackDetail> {
    return this.unitOfWork.runInTransaction(tx =>
      this.detail(tx, teamId, feedbackId),
    );
  }

  listRevisions(
    teamId: string,
    feedbackId: string,
  ): Promise<FeedbackRevisionHistory> {
    return this.unitOfWork.runInTransaction(tx =>
      this.revisions(tx, teamId, feedbackId),
    );
  }

  listOwnShared(
    teamId: string,
    userId: string,
    page: PageRequest,
  ): Promise<SharedFeedbackPage> {
    return this.unitOfWork.runInTransaction(tx =>
      this.ownShared(tx, teamId, userId, page),
    );
  }

  private async teamPage(
    tx: TransactionScope,
    teamId: string,
    page: PageRequest,
  ): Promise<FeedbackSummaryPage> {
    const items = await this.repository.listForTeam(tx, teamId, page);
    const total = await this.repository.countForTeam(tx, teamId);
    return { items, total, limit: page.limit, offset: page.offset };
  }

  private async detail(
    tx: TransactionScope,
    teamId: string,
    feedbackId: string,
  ): Promise<CoachFeedbackDetail> {
    const feedback = await this.repository.findForWrite(tx, teamId, feedbackId);
    if (feedback === null) {
      throw new CoachFeedbackNotFoundError();
    }
    const acknowledgement = await this.repository.findAcknowledgement(
      tx,
      feedbackId,
    );
    return { feedback, acknowledgement };
  }

  private async revisions(
    tx: TransactionScope,
    teamId: string,
    feedbackId: string,
  ): Promise<FeedbackRevisionHistory> {
    const feedback = await this.repository.findForWrite(tx, teamId, feedbackId);
    if (feedback === null) {
      throw new CoachFeedbackNotFoundError();
    }
    const items = await this.repository.listRevisions(
      tx,
      teamId,
      feedback.familyId,
    );
    return { items };
  }

  private async ownShared(
    tx: TransactionScope,
    teamId: string,
    userId: string,
    page: PageRequest,
  ): Promise<SharedFeedbackPage> {
    const found = await this.repository.listOwnShared(tx, teamId, userId, page);
    return this.assembleShared(found, page);
  }

  private assembleShared(
    found: OwnFeedbackResult,
    page: PageRequest,
  ): SharedFeedbackPage {
    return {
      items: found.feedback.map(feedback =>
        toSharedFeedback(
          feedback,
          found.acknowledgements.get(feedback.id) ?? null,
        ),
      ),
      total: found.total,
      limit: page.limit,
      offset: page.offset,
    };
  }
}
