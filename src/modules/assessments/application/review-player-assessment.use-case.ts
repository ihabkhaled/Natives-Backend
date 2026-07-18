import type { AuthUserIdentity } from '@core/auth';
import { CLOCK_PORT, type ClockPort } from '@core/clock/clock.port';
import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { AuditRecorderService } from '@modules/platform';
import { Inject, Injectable } from '@nestjs/common';

import { assertReviewerIndependence } from '../domain/player-assessment.policy';
import {
  canTransition,
  resolveReviewTarget,
  reviewNeedsIndependence,
} from '../domain/player-assessment.state-machine';
import { AssessmentVersionConflictError } from '../errors/assessment-version-conflict.error';
import { InvalidAssessmentTransitionError } from '../errors/invalid-assessment-transition.error';
import { PlayerAssessmentRepository } from '../infrastructure/player-assessment.repository';
import {
  buildAudit,
  buildReviewTransition,
} from '../lib/player-assessments.builders';
import { PLAYER_ASSESSMENT_REVIEWED_ACTION } from '../model/player-assessments.constants';
import type {
  PlayerAssessment,
  PlayerAssessmentDetail,
  ReviewPlayerAssessmentCommand,
} from '../model/player-assessments.types';
import { PlayerAssessmentLookupService } from './player-assessment-lookup.service';

/**
 * Reviewer workflow: claim review, approve, or reopen a submitted assessment.
 * The reviewer must be independent of the evaluator — self-review and, critically,
 * self-approval are FORBIDDEN. The transition is validated by the pure state
 * machine and applied under optimistic concurrency, with an audit entry.
 */
@Injectable()
export class ReviewPlayerAssessmentUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    private readonly lookup: PlayerAssessmentLookupService,
    private readonly repository: PlayerAssessmentRepository,
    private readonly audit: AuditRecorderService,
  ) {}

  execute(
    actor: AuthUserIdentity,
    teamId: string,
    assessmentId: string,
    command: ReviewPlayerAssessmentCommand,
  ): Promise<PlayerAssessmentDetail> {
    return this.unitOfWork.runInTransaction(tx =>
      this.run(tx, actor, teamId, assessmentId, command),
    );
  }

  private async run(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    assessmentId: string,
    command: ReviewPlayerAssessmentCommand,
  ): Promise<PlayerAssessmentDetail> {
    const current = await this.lookup.requireForWrite(tx, teamId, assessmentId);
    this.assertReviewable(current, actor, command);
    const reviewed = await this.transition(
      tx,
      teamId,
      assessmentId,
      command,
      actor,
    );
    return this.finish(tx, actor, reviewed);
  }

  private assertReviewable(
    current: PlayerAssessment,
    actor: AuthUserIdentity,
    command: ReviewPlayerAssessmentCommand,
  ): void {
    if (reviewNeedsIndependence(command.decision)) {
      assertReviewerIndependence(actor.userId, current.evaluatorUserId);
    }
    const target = resolveReviewTarget(command.decision);
    if (!canTransition(current.status, target)) {
      throw new InvalidAssessmentTransitionError();
    }
  }

  private async transition(
    tx: TransactionScope,
    teamId: string,
    assessmentId: string,
    command: ReviewPlayerAssessmentCommand,
    actor: AuthUserIdentity,
  ): Promise<PlayerAssessment> {
    const reviewed = await this.repository.applyTransition(
      tx,
      buildReviewTransition(
        assessmentId,
        teamId,
        command.decision,
        command.expectedRecordVersion,
        actor.userId,
        this.clock.now(),
      ),
    );
    if (reviewed === null) {
      throw new AssessmentVersionConflictError();
    }
    return reviewed;
  }

  private async finish(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    reviewed: PlayerAssessment,
  ): Promise<PlayerAssessmentDetail> {
    await this.audit.record(
      tx,
      buildAudit(PLAYER_ASSESSMENT_REVIEWED_ACTION, actor.userId, reviewed),
    );
    const values = await this.repository.findValues(tx, reviewed.id);
    return { assessment: reviewed, values };
  }
}
