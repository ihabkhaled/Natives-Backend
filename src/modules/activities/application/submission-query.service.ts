import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import { isSubmissionOwnedBy } from '../domain/activity-submission.policy';
import { ActivitySubmissionNotFoundError } from '../errors/activity-submission-not-found.error';
import { ActivityBuddyRepository } from '../infrastructure/activity-buddy.repository';
import { ActivityEvidenceRepository } from '../infrastructure/activity-evidence.repository';
import { ActivitySubmissionRepository } from '../infrastructure/activity-submission.repository';
import { toSubmissionDetailView } from '../lib/activity.response.mapper';
import type {
  ActivityBuddy,
  ActivitySubmission,
  PagedResult,
  PageRequest,
} from '../model/activity.types';
import type { SubmissionDetailView } from '../model/activity.views';

/**
 * Member read side. Every list is a single bounded, deterministically ordered page
 * in one transaction, and returns ONLY the caller's own submissions resolved from
 * the authenticated identity. Views are member-safe: no reviewer note and no
 * evidence storage reference ever leave here — only a bounded evidence count.
 */
@Injectable()
export class SubmissionQueryService {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    private readonly submissions: ActivitySubmissionRepository,
    private readonly buddies: ActivityBuddyRepository,
    private readonly evidence: ActivityEvidenceRepository,
  ) {}

  listForMember(
    teamId: string,
    userId: string,
    page: PageRequest,
  ): Promise<PagedResult<SubmissionDetailView>> {
    return this.unitOfWork.runInTransaction(tx =>
      this.memberPage(tx, teamId, userId, page),
    );
  }

  getOwnDetail(
    teamId: string,
    userId: string,
    submissionId: string,
  ): Promise<SubmissionDetailView> {
    return this.unitOfWork.runInTransaction(tx =>
      this.ownDetail(tx, teamId, userId, submissionId),
    );
  }

  private async memberPage(
    tx: TransactionScope,
    teamId: string,
    userId: string,
    page: PageRequest,
  ): Promise<PagedResult<SubmissionDetailView>> {
    const rows = await this.submissions.listForMember(tx, teamId, userId, page);
    const total = await this.submissions.countForMember(tx, teamId, userId);
    return this.assemble(tx, rows, total, page);
  }

  private async ownDetail(
    tx: TransactionScope,
    teamId: string,
    userId: string,
    submissionId: string,
  ): Promise<SubmissionDetailView> {
    const submission = await this.submissions.findForWrite(
      tx,
      teamId,
      submissionId,
    );
    if (submission === null || !isSubmissionOwnedBy(submission, userId)) {
      throw new ActivitySubmissionNotFoundError();
    }
    return this.detailOf(tx, submission);
  }

  private async detailOf(
    tx: TransactionScope,
    submission: ActivitySubmission,
  ): Promise<SubmissionDetailView> {
    const buddies = await this.buddies.listForSubmission(tx, submission.id);
    const evidenceCount = await this.evidence.countForSubmission(
      tx,
      submission.id,
    );
    return toSubmissionDetailView({ submission, buddies, evidenceCount });
  }

  private async assemble(
    tx: TransactionScope,
    submissions: readonly ActivitySubmission[],
    total: number,
    page: PageRequest,
  ): Promise<PagedResult<SubmissionDetailView>> {
    const ids = submissions.map(submission => submission.id);
    const buddies = await this.buddies.buddiesBySubmission(tx, ids);
    const counts = await this.evidence.countsBySubmission(tx, ids);
    return {
      items: submissions.map(submission =>
        this.viewOf(submission, buddies, counts),
      ),
      total,
      limit: page.limit,
      offset: page.offset,
    };
  }

  private viewOf(
    submission: ActivitySubmission,
    buddies: ReadonlyMap<string, readonly ActivityBuddy[]>,
    counts: ReadonlyMap<string, number>,
  ): SubmissionDetailView {
    return toSubmissionDetailView({
      submission,
      buddies: buddies.get(submission.id) ?? [],
      evidenceCount: counts.get(submission.id) ?? 0,
    });
  }
}
