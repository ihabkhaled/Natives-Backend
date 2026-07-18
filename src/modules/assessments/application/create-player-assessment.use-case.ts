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
import { AssessmentDuplicateError } from '../errors/assessment-duplicate.error';
import { AssessmentScopeNotFoundError } from '../errors/assessment-scope-not-found.error';
import { PlayerAssessmentRepository } from '../infrastructure/player-assessment.repository';
import {
  buildAudit,
  buildNewAssessment,
  buildValueRows,
} from '../lib/player-assessments.builders';
import { PLAYER_ASSESSMENT_CREATED_ACTION } from '../model/player-assessments.constants';
import type {
  CreatePlayerAssessmentCommand,
  PlayerAssessment,
  PlayerAssessmentContext,
  PlayerAssessmentDetail,
} from '../model/player-assessments.types';
import { AssessmentScopeService } from './assessment-scope.service';

/**
 * Creates the DRAFT (revision 1) of a per-player assessment: the evaluator's
 * private working copy against a published template + active period. Validates
 * team/membership scope, resolves the pinned template and its metric scale
 * bounds, checks every provided value (null-not-zero), and writes the assessment,
 * its values, and an audit entry in one transaction. One live assessment per
 * evaluator/player/period is enforced.
 */
@Injectable()
export class CreatePlayerAssessmentUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR_PORT) private readonly idGenerator: IdGeneratorPort,
    private readonly scope: AssessmentScopeService,
    private readonly repository: PlayerAssessmentRepository,
    private readonly audit: AuditRecorderService,
  ) {}

  execute(
    actor: AuthUserIdentity,
    teamId: string,
    command: CreatePlayerAssessmentCommand,
  ): Promise<PlayerAssessmentDetail> {
    return this.unitOfWork.runInTransaction(tx =>
      this.run(tx, actor, teamId, command),
    );
  }

  private async run(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    command: CreatePlayerAssessmentCommand,
  ): Promise<PlayerAssessmentDetail> {
    await this.scope.validate(tx, teamId, null);
    await this.scope.requireMembership(tx, teamId, command.membershipId);
    const context = await this.requireContext(tx, teamId, command.periodId);
    assertValuesAgainstTemplate(command.values, context.metrics);
    await this.requireUnique(tx, actor, command);
    const assessment = await this.persist(tx, actor, teamId, context, command);
    return this.attachValues(tx, actor, assessment, command);
  }

  private async requireContext(
    tx: TransactionScope,
    teamId: string,
    periodId: string,
  ): Promise<PlayerAssessmentContext> {
    const context = await this.repository.loadContext(tx, teamId, periodId);
    if (context === null) {
      throw new AssessmentScopeNotFoundError();
    }
    return context;
  }

  private async requireUnique(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    command: CreatePlayerAssessmentCommand,
  ): Promise<void> {
    const exists = await this.repository.liveExists(
      tx,
      command.periodId,
      command.membershipId,
      actor.userId,
    );
    if (exists) {
      throw new AssessmentDuplicateError();
    }
  }

  private persist(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    context: PlayerAssessmentContext,
    command: CreatePlayerAssessmentCommand,
  ): Promise<PlayerAssessment> {
    return this.repository.insertAssessment(
      tx,
      buildNewAssessment(
        this.idGenerator.generate(),
        teamId,
        context,
        command,
        actor.userId,
        this.clock.now(),
      ),
    );
  }

  private async attachValues(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    assessment: PlayerAssessment,
    command: CreatePlayerAssessmentCommand,
  ): Promise<PlayerAssessmentDetail> {
    const values = buildValueRows(
      assessment.id,
      command.values,
      () => this.idGenerator.generate(),
      this.clock.now(),
    );
    await this.repository.insertValues(tx, values);
    await this.audit.record(
      tx,
      buildAudit(PLAYER_ASSESSMENT_CREATED_ACTION, actor.userId, assessment),
    );
    return {
      assessment,
      values: await this.repository.findValues(tx, assessment.id),
    };
  }
}
