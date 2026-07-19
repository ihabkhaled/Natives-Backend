import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import { ActivitySubmissionNotFoundError } from '../errors/activity-submission-not-found.error';
import { ActivityReviewRepository } from '../infrastructure/activity-review.repository';
import { ActivitySubmissionRepository } from '../infrastructure/activity-submission.repository';
import { toReviewSubmissionView } from '../lib/activity.response.mapper';
import type {
  ActivitySubmission,
  PagedResult,
  ReviewQueueQuery,
} from '../model/activity.types';
import type {
  ReviewDetailView,
  ReviewSubmissionView,
} from '../model/activity.views';
import { ReviewDetailService } from './review-detail.service';

/**
 * Reviewer read side (activity.review). The queue is a single bounded, allowlisted,
 * deterministically ordered page — oldest submitted first for fair SLA handling —
 * scoped to the team, never draft or withdrawn claims. The detail read adds the
 * credited buddies, evidence count, and anti-abuse signals for one submission.
 */
@Injectable()
export class ReviewQueueService {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    private readonly review: ActivityReviewRepository,
    private readonly submissions: ActivitySubmissionRepository,
    private readonly detail: ReviewDetailService,
  ) {}

  listQueue(
    teamId: string,
    query: ReviewQueueQuery,
  ): Promise<PagedResult<ReviewSubmissionView>> {
    return this.unitOfWork.runInTransaction(tx =>
      this.queuePage(tx, teamId, query),
    );
  }

  getDetail(teamId: string, submissionId: string): Promise<ReviewDetailView> {
    return this.unitOfWork.runInTransaction(tx =>
      this.detailOf(tx, teamId, submissionId),
    );
  }

  private async queuePage(
    tx: TransactionScope,
    teamId: string,
    query: ReviewQueueQuery,
  ): Promise<PagedResult<ReviewSubmissionView>> {
    const rows = await this.review.listQueue(tx, teamId, query);
    const total = await this.review.countQueue(tx, teamId, query);
    return this.page(rows, total, query);
  }

  private page(
    rows: readonly ActivitySubmission[],
    total: number,
    query: ReviewQueueQuery,
  ): PagedResult<ReviewSubmissionView> {
    return {
      items: rows.map(row => toReviewSubmissionView(row)),
      total,
      limit: query.page.limit,
      offset: query.page.offset,
    };
  }

  private async detailOf(
    tx: TransactionScope,
    teamId: string,
    submissionId: string,
  ): Promise<ReviewDetailView> {
    const submission = await this.submissions.findForWrite(
      tx,
      teamId,
      submissionId,
    );
    if (submission === null) {
      throw new ActivitySubmissionNotFoundError();
    }
    return this.detail.assembleDetail(tx, submission);
  }
}
