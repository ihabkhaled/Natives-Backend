import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { assertReviewerMayReview } from '../domain/activity-review.policy';
import { ActivityReviewRepository } from '../infrastructure/activity-review.repository';
import type { ActivitySubmission } from '../model/activity.types';
import { SubmissionLookupService } from './submission-lookup.service';

/**
 * Shared load-and-guard for every reviewer write. Resolves the submission in the
 * caller's team (a missing one is a 404 that hides existence) and then enforces
 * the conflict-of-interest rule: a reviewer may not act on their own claim or one
 * where they are a credited buddy (403), proven server-side against the database.
 */
@Injectable()
export class ReviewEligibilityService {
  constructor(
    private readonly lookup: SubmissionLookupService,
    private readonly review: ActivityReviewRepository,
  ) {}

  async requireEligible(
    scope: TransactionScope,
    teamId: string,
    submissionId: string,
    reviewerUserId: string,
  ): Promise<ActivitySubmission> {
    const submission = await this.lookup.requireForWrite(
      scope,
      teamId,
      submissionId,
    );
    const isBuddy = await this.review.isReviewerCreditedBuddy(
      scope,
      submissionId,
      reviewerUserId,
    );
    assertReviewerMayReview(submission, reviewerUserId, isBuddy);
    return submission;
  }
}
