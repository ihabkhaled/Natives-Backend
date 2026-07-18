import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { PlayerAssessmentNotFoundError } from '../errors/player-assessment-not-found.error';
import { PlayerAssessmentRepository } from '../infrastructure/player-assessment.repository';
import type { PlayerAssessment } from '../model/player-assessments.types';

/**
 * Shared load-and-guard helpers for player-assessment write use-cases. Missing
 * or out-of-scope resources resolve to a 404 that hides existence; ownership
 * violations do the same so an evaluator cannot probe another's drafts.
 */
@Injectable()
export class PlayerAssessmentLookupService {
  constructor(private readonly repository: PlayerAssessmentRepository) {}

  async requireForWrite(
    scope: TransactionScope,
    teamId: string,
    assessmentId: string,
  ): Promise<PlayerAssessment> {
    const assessment = await this.repository.findForWrite(
      scope,
      teamId,
      assessmentId,
    );
    if (assessment === null) {
      throw new PlayerAssessmentNotFoundError();
    }
    return assessment;
  }

  requireOwned(assessment: PlayerAssessment, actorUserId: string): void {
    if (assessment.evaluatorUserId !== actorUserId) {
      throw new PlayerAssessmentNotFoundError();
    }
  }
}
