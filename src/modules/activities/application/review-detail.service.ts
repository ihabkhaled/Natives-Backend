import { CLOCK_PORT, type ClockPort } from '@core/clock/clock.port';
import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import { detectAbuseSignals } from '../domain/activity-abuse.policy';
import { ActivityBuddyRepository } from '../infrastructure/activity-buddy.repository';
import { ActivityEvidenceRepository } from '../infrastructure/activity-evidence.repository';
import { ActivityReviewRepository } from '../infrastructure/activity-review.repository';
import { buildAbuseFacts } from '../lib/activity.builders';
import { buildAbuseProbeWindow, toCalendarDay } from '../lib/activity.helpers';
import { toReviewDetailView } from '../lib/activity.response.mapper';
import type { AbuseSignal } from '../model/activity.enums';
import type { ActivitySubmission } from '../model/activity.types';
import type { ReviewDetailView } from '../model/activity.views';

/**
 * Assembles a reviewer's submission detail: credited buddies, a bounded evidence
 * count, and the anti-abuse signals computed from bounded probe counts against the
 * frozen server clock. Reused by both the queue detail read and every reviewer
 * write so the reviewer always sees the same signals they act on.
 */
@Injectable()
export class ReviewDetailService {
  constructor(
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    private readonly review: ActivityReviewRepository,
    private readonly buddies: ActivityBuddyRepository,
    private readonly evidence: ActivityEvidenceRepository,
  ) {}

  async assembleDetail(
    scope: TransactionScope,
    submission: ActivitySubmission,
  ): Promise<ReviewDetailView> {
    const buddies = await this.buddies.listForSubmission(scope, submission.id);
    const evidenceCount = await this.evidence.countForSubmission(
      scope,
      submission.id,
    );
    const signals = await this.computeSignals(scope, submission);
    return toReviewDetailView({ submission, buddies, evidenceCount, signals });
  }

  private async computeSignals(
    scope: TransactionScope,
    submission: ActivitySubmission,
  ): Promise<readonly AbuseSignal[]> {
    const today = toCalendarDay(this.clock.now());
    const counts = await this.review.abuseCounts(
      scope,
      submission.membershipId,
      submission.id,
      submission.performedOn,
      buildAbuseProbeWindow(today),
    );
    return detectAbuseSignals(buildAbuseFacts(submission, today, counts));
  }
}
