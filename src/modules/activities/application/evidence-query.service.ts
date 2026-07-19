import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import { ActivitySubmissionNotFoundError } from '../errors/activity-submission-not-found.error';
import { ActivityEvidenceRepository } from '../infrastructure/activity-evidence.repository';
import { ActivitySubmissionRepository } from '../infrastructure/activity-submission.repository';
import { toEvidenceView } from '../lib/activity.response.mapper';
import { EVIDENCE_MAX_ITEMS } from '../model/activities.constants';
import type { PagedResult } from '../model/activity.types';
import type { EvidenceView } from '../model/activity.views';

/**
 * Reviewer-scoped read of a submission's evidence (evidence.read.review). The
 * private storage reference is exposed ONLY here; no member surface ever selects
 * it. A submission outside the caller's team is a 404 that hides existence.
 */
@Injectable()
export class EvidenceQueryService {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    private readonly submissions: ActivitySubmissionRepository,
    private readonly evidence: ActivityEvidenceRepository,
  ) {}

  listForReview(
    teamId: string,
    submissionId: string,
  ): Promise<PagedResult<EvidenceView>> {
    return this.unitOfWork.runInTransaction(tx =>
      this.reviewList(tx, teamId, submissionId),
    );
  }

  private async reviewList(
    tx: TransactionScope,
    teamId: string,
    submissionId: string,
  ): Promise<PagedResult<EvidenceView>> {
    await this.requireSubmission(tx, teamId, submissionId);
    const items = await this.evidence.listForSubmission(tx, submissionId);
    return {
      items: items.map(item => toEvidenceView(item)),
      total: items.length,
      limit: EVIDENCE_MAX_ITEMS,
      offset: 0,
    };
  }

  private async requireSubmission(
    tx: TransactionScope,
    teamId: string,
    submissionId: string,
  ): Promise<void> {
    const submission = await this.submissions.findForWrite(
      tx,
      teamId,
      submissionId,
    );
    if (submission === null) {
      throw new ActivitySubmissionNotFoundError();
    }
  }
}
