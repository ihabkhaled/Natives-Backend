import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { CoachFeedbackNotFoundError } from '../errors/coach-feedback-not-found.error';
import { CoachFeedbackRepository } from '../infrastructure/coach-feedback.repository';
import type { CoachFeedback } from '../model/feedback.types';

/**
 * Shared load-and-guard helpers for coach-feedback write use-cases. Missing or
 * out-of-scope records resolve to a 404 that hides existence; an authorship
 * violation does the same so one coach cannot probe another's private drafts.
 */
@Injectable()
export class FeedbackLookupService {
  constructor(private readonly repository: CoachFeedbackRepository) {}

  async requireForWrite(
    scope: TransactionScope,
    teamId: string,
    feedbackId: string,
  ): Promise<CoachFeedback> {
    const feedback = await this.repository.findForWrite(
      scope,
      teamId,
      feedbackId,
    );
    if (feedback === null) {
      throw new CoachFeedbackNotFoundError();
    }
    return feedback;
  }

  requireAuthor(feedback: CoachFeedback, actorUserId: string): void {
    if (feedback.authorUserId !== actorUserId) {
      throw new CoachFeedbackNotFoundError();
    }
  }
}
