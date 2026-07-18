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

import { canPublish } from '../domain/player-assessment.state-machine';
import { AssessmentVersionConflictError } from '../errors/assessment-version-conflict.error';
import { InvalidAssessmentTransitionError } from '../errors/invalid-assessment-transition.error';
import { PlayerAssessmentRepository } from '../infrastructure/player-assessment.repository';
import {
  buildAudit,
  buildPublishedEvent,
  buildPublishTransition,
} from '../lib/player-assessments.builders';
import { PLAYER_ASSESSMENT_PUBLISHED_ACTION } from '../model/player-assessments.constants';
import type {
  PlayerAssessment,
  PlayerAssessmentDetail,
  PublishPlayerAssessmentCommand,
} from '../model/player-assessments.types';
import { PlayerAssessmentLookupService } from './player-assessment-lookup.service';

/**
 * Publishes an APPROVED assessment, making it the player-visible, immutable
 * result. Transitions to PUBLISHED under optimistic concurrency and enqueues a
 * versioned `assessment.published` event atomically. Once published the snapshot
 * is never edited in place — corrections create a new revision.
 */
@Injectable()
export class PublishPlayerAssessmentUseCase {
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
    command: PublishPlayerAssessmentCommand,
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
    command: PublishPlayerAssessmentCommand,
  ): Promise<PlayerAssessmentDetail> {
    const current = await this.lookup.requireForWrite(tx, teamId, assessmentId);
    if (!canPublish(current.status)) {
      throw new InvalidAssessmentTransitionError();
    }
    const published = await this.transition(
      tx,
      teamId,
      assessmentId,
      command,
      actor,
    );
    return this.finish(tx, actor, published);
  }

  private async transition(
    tx: TransactionScope,
    teamId: string,
    assessmentId: string,
    command: PublishPlayerAssessmentCommand,
    actor: AuthUserIdentity,
  ): Promise<PlayerAssessment> {
    const published = await this.repository.applyTransition(
      tx,
      buildPublishTransition(
        assessmentId,
        teamId,
        command.expectedRecordVersion,
        actor.userId,
        this.clock.now(),
      ),
    );
    if (published === null) {
      throw new AssessmentVersionConflictError();
    }
    return published;
  }

  private async finish(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    published: PlayerAssessment,
  ): Promise<PlayerAssessmentDetail> {
    await this.audit.record(
      tx,
      buildAudit(PLAYER_ASSESSMENT_PUBLISHED_ACTION, actor.userId, published),
    );
    await this.events.enqueue(tx, buildPublishedEvent(published));
    const values = await this.repository.findValues(tx, published.id);
    return { assessment: published, values };
  }
}
