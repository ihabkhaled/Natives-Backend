import type { AuthUserIdentity } from '@core/auth';
import { CLOCK_PORT, type ClockPort } from '@core/clock/clock.port';
import {
  ID_GENERATOR_PORT,
  type IdGeneratorPort,
} from '@core/id-generator/id-generator.port';
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

import { assertValuesAgainstTemplate } from '../domain/player-assessment.policy';
import { canCorrect } from '../domain/player-assessment.state-machine';
import { InvalidAssessmentTransitionError } from '../errors/invalid-assessment-transition.error';
import { PlayerAssessmentRepository } from '../infrastructure/player-assessment.repository';
import {
  buildAudit,
  buildCorrectionAssessment,
  buildRevisedEvent,
  buildSupersede,
  buildValueRows,
} from '../lib/player-assessments.builders';
import { PLAYER_ASSESSMENT_REVISED_ACTION } from '../model/player-assessments.constants';
import type {
  CorrectPlayerAssessmentCommand,
  PlayerAssessment,
  PlayerAssessmentDetail,
} from '../model/player-assessments.types';
import { PlayerAssessmentLookupService } from './player-assessment-lookup.service';

/**
 * Corrects a PUBLISHED (or already-revised) assessment. The published snapshot is
 * IMMUTABLE — this never edits it in place. Instead it supersedes the prior row
 * and inserts a new REVISED revision (same family, revision + 1) carrying the
 * corrected values, then enqueues a versioned `assessment.revised` event. All in
 * one transaction; the prior published values remain auditable.
 */
@Injectable()
export class CorrectPlayerAssessmentUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR_PORT) private readonly idGenerator: IdGeneratorPort,
    private readonly lookup: PlayerAssessmentLookupService,
    private readonly repository: PlayerAssessmentRepository,
    private readonly audit: AuditRecorderService,
    private readonly events: RecordDomainEventService,
  ) {}

  execute(
    actor: AuthUserIdentity,
    teamId: string,
    assessmentId: string,
    command: CorrectPlayerAssessmentCommand,
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
    command: CorrectPlayerAssessmentCommand,
  ): Promise<PlayerAssessmentDetail> {
    const previous = await this.lookup.requireForWrite(
      tx,
      teamId,
      assessmentId,
    );
    if (!canCorrect(previous.status) || previous.supersededAt !== null) {
      throw new InvalidAssessmentTransitionError();
    }
    const bounds = await this.repository.loadTemplateBounds(
      tx,
      previous.templateId,
    );
    assertValuesAgainstTemplate(command.values, bounds);
    const revision = await this.supersedeAndInsert(
      tx,
      actor,
      previous,
      command,
    );
    return this.finish(tx, actor, previous, revision, command);
  }

  private async supersedeAndInsert(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    previous: PlayerAssessment,
    command: CorrectPlayerAssessmentCommand,
  ): Promise<PlayerAssessment> {
    const newId = this.idGenerator.generate();
    const now = this.clock.now();
    const superseded = await this.repository.supersede(
      tx,
      buildSupersede(previous.id, newId, now),
    );
    if (!superseded) {
      throw new InvalidAssessmentTransitionError();
    }
    return this.repository.insertAssessment(
      tx,
      buildCorrectionAssessment(
        newId,
        previous,
        command.summary,
        actor.userId,
        now,
      ),
    );
  }

  private async finish(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    previous: PlayerAssessment,
    revision: PlayerAssessment,
    command: CorrectPlayerAssessmentCommand,
  ): Promise<PlayerAssessmentDetail> {
    await this.repository.insertValues(
      tx,
      buildValueRows(
        revision.id,
        command.values,
        () => this.idGenerator.generate(),
        this.clock.now(),
      ),
    );
    await this.audit.record(
      tx,
      buildAudit(PLAYER_ASSESSMENT_REVISED_ACTION, actor.userId, revision),
    );
    await this.events.enqueue(tx, buildRevisedEvent(revision, previous.id));
    const values = await this.repository.findValues(tx, revision.id);
    return { assessment: revision, values };
  }
}
