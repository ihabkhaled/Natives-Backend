import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { isSubmissionOwnedBy } from '../domain/activity-submission.policy';
import { ActivitySubmissionNotFoundError } from '../errors/activity-submission-not-found.error';
import { ActivitySubmissionRepository } from '../infrastructure/activity-submission.repository';
import type { ActivitySubmission } from '../model/activity.types';

/**
 * Shared load-and-guard helpers for submission write use-cases. A missing or
 * out-of-scope submission resolves to a 404 that hides existence; an ownership
 * violation does the same so one member cannot probe or mutate another's claim.
 */
@Injectable()
export class SubmissionLookupService {
  constructor(private readonly repository: ActivitySubmissionRepository) {}

  async requireForWrite(
    scope: TransactionScope,
    teamId: string,
    submissionId: string,
  ): Promise<ActivitySubmission> {
    const submission = await this.repository.findForWrite(
      scope,
      teamId,
      submissionId,
    );
    if (submission === null) {
      throw new ActivitySubmissionNotFoundError();
    }
    return submission;
  }

  requireOwner(submission: ActivitySubmission, actorUserId: string): void {
    if (!isSubmissionOwnedBy(submission, actorUserId)) {
      throw new ActivitySubmissionNotFoundError();
    }
  }
}
