import type { AuthUserIdentity } from '@core/auth';
import { CLOCK_PORT, type ClockPort } from '@core/clock/clock.port';
import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import {
  AuditRecorderService,
  RecordDomainEventService,
} from '@modules/platform';
import { Inject, Injectable } from '@nestjs/common';

import { assertComplete } from '../domain/player-assessment.policy';
import { canTransition } from '../domain/player-assessment.state-machine';
import { AssessmentScopeNotFoundError } from '../errors/assessment-scope-not-found.error';
import { AssessmentVersionConflictError } from '../errors/assessment-version-conflict.error';
import { InvalidAssessmentTransitionError } from '../errors/invalid-assessment-transition.error';
import { PlayerAssessmentRepository } from '../infrastructure/player-assessment.repository';
import {
  buildAudit,
  buildSubmittedEvent,
  buildSubmitTransition,
} from '../lib/player-assessments.builders';
import { PLAYER_ASSESSMENT_SUBMITTED_ACTION } from '../model/player-assessments.constants';
import { PlayerAssessmentStatus } from '../model/player-assessments.enums';
import type {
  PlayerAssessment,
  PlayerAssessmentDetail,
  SubmitPlayerAssessmentCommand,
} from '../model/player-assessments.types';
import { PlayerAssessmentLookupService } from './player-assessment-lookup.service';

/**
 * Submits a DRAFT into the review workflow. The owning evaluator submits; the
 * assessment must be complete — every REQUIRED metric carries a measured value
 * (a missing/null value is never inferred as zero). Transitions to SUBMITTED
 * under optimistic concurrency and enqueues a versioned `assessment.submitted`
 * event atomically.
 */
@Injectable()
export class SubmitPlayerAssessmentUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    private readonly lookup: PlayerAssessmentLookupService,
    private readonly repository: PlayerAssessmentRepository,
    private readonly audit: AuditRecorderService,
    private readonly events: RecordDomainEventService,
  ) {}

  execute(
    actor: AuthUserIdentity,
    teamId: string,
    assessmentId: string,
    command: SubmitPlayerAssessmentCommand,
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
    command: SubmitPlayerAssessmentCommand,
  ): Promise<PlayerAssessmentDetail> {
    const current = await this.lookup.requireForWrite(tx, teamId, assessmentId);
    this.lookup.requireOwned(current, actor.userId);
    if (!canTransition(current.status, PlayerAssessmentStatus.Submitted)) {
      throw new InvalidAssessmentTransitionError();
    }
    await this.assertComplete(tx, teamId, current);
    const submitted = await this.transition(
      tx,
      teamId,
      assessmentId,
      command,
      actor,
    );
    return this.finish(tx, actor, submitted);
  }

  private async assertComplete(
    tx: TransactionScope,
    teamId: string,
    current: PlayerAssessment,
  ): Promise<void> {
    const context = await this.repository.loadContext(
      tx,
      teamId,
      current.periodId,
    );
    if (context === null) {
      throw new AssessmentScopeNotFoundError();
    }
    const values = await this.repository.findValues(tx, current.id);
    assertComplete(values, context.metrics);
  }

  private async transition(
    tx: TransactionScope,
    teamId: string,
    assessmentId: string,
    command: SubmitPlayerAssessmentCommand,
    actor: AuthUserIdentity,
  ): Promise<PlayerAssessment> {
    const submitted = await this.repository.applyTransition(
      tx,
      buildSubmitTransition(
        assessmentId,
        teamId,
        command.expectedRecordVersion,
        actor.userId,
        this.clock.now(),
      ),
    );
    if (submitted === null) {
      throw new AssessmentVersionConflictError();
    }
    return submitted;
  }

  private async finish(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    submitted: PlayerAssessment,
  ): Promise<PlayerAssessmentDetail> {
    await this.audit.record(
      tx,
      buildAudit(PLAYER_ASSESSMENT_SUBMITTED_ACTION, actor.userId, submitted),
    );
    await this.events.enqueue(tx, buildSubmittedEvent(submitted));
    const values = await this.repository.findValues(tx, submitted.id);
    return { assessment: submitted, values };
  }
}
