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
import { AuditRecorderService } from '@modules/platform';
import { Inject, Injectable } from '@nestjs/common';

import { assertValuesAgainstTemplate } from '../domain/player-assessment.policy';
import { canEditDraft } from '../domain/player-assessment.state-machine';
import { AssessmentScopeNotFoundError } from '../errors/assessment-scope-not-found.error';
import { AssessmentVersionConflictError } from '../errors/assessment-version-conflict.error';
import { InvalidAssessmentTransitionError } from '../errors/invalid-assessment-transition.error';
import { PlayerAssessmentRepository } from '../infrastructure/player-assessment.repository';
import { buildAudit, buildValueRows } from '../lib/player-assessments.builders';
import { PLAYER_ASSESSMENT_UPDATED_ACTION } from '../model/player-assessments.constants';
import type {
  PlayerAssessment,
  PlayerAssessmentDetail,
  UpdatePlayerAssessmentCommand,
} from '../model/player-assessments.types';
import { PlayerAssessmentLookupService } from './player-assessment-lookup.service';

/**
 * Autosave upsert of a DRAFT assessment: replaces the evaluator's per-metric
 * values and summary under optimistic concurrency. Only the owning evaluator may
 * edit, only while the assessment is a draft, and every value is re-validated
 * against the template scale bounds (null-not-zero) before the atomic replace.
 */
@Injectable()
export class UpdatePlayerAssessmentUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR_PORT) private readonly idGenerator: IdGeneratorPort,
    private readonly lookup: PlayerAssessmentLookupService,
    private readonly repository: PlayerAssessmentRepository,
    private readonly audit: AuditRecorderService,
  ) {}

  execute(
    actor: AuthUserIdentity,
    teamId: string,
    assessmentId: string,
    command: UpdatePlayerAssessmentCommand,
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
    command: UpdatePlayerAssessmentCommand,
  ): Promise<PlayerAssessmentDetail> {
    const current = await this.lookup.requireForWrite(tx, teamId, assessmentId);
    this.lookup.requireOwned(current, actor.userId);
    if (!canEditDraft(current.status)) {
      throw new InvalidAssessmentTransitionError();
    }
    await this.validateValues(tx, teamId, current, command);
    const updated = await this.applyUpdate(tx, teamId, assessmentId, command);
    return this.replaceValues(tx, actor, updated, command);
  }

  private async validateValues(
    tx: TransactionScope,
    teamId: string,
    current: PlayerAssessment,
    command: UpdatePlayerAssessmentCommand,
  ): Promise<void> {
    const context = await this.repository.loadContext(
      tx,
      teamId,
      current.periodId,
    );
    if (context === null) {
      throw new AssessmentScopeNotFoundError();
    }
    assertValuesAgainstTemplate(command.values, context.metrics);
  }

  private async applyUpdate(
    tx: TransactionScope,
    teamId: string,
    assessmentId: string,
    command: UpdatePlayerAssessmentCommand,
  ): Promise<PlayerAssessment> {
    const updated = await this.repository.updateDraft(
      tx,
      assessmentId,
      teamId,
      command.summary,
      command.expectedRecordVersion,
      this.clock.now(),
    );
    if (updated === null) {
      throw new AssessmentVersionConflictError();
    }
    return updated;
  }

  private async replaceValues(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    updated: PlayerAssessment,
    command: UpdatePlayerAssessmentCommand,
  ): Promise<PlayerAssessmentDetail> {
    await this.repository.clearValues(tx, updated.id);
    await this.repository.insertValues(
      tx,
      buildValueRows(
        updated.id,
        command.values,
        () => this.idGenerator.generate(),
        this.clock.now(),
      ),
    );
    await this.audit.record(
      tx,
      buildAudit(PLAYER_ASSESSMENT_UPDATED_ACTION, actor.userId, updated),
    );
    const values = await this.repository.findValues(tx, updated.id);
    return { assessment: updated, values };
  }
}
