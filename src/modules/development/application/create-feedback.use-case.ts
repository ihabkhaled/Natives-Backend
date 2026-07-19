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

import { CoachFeedbackRepository } from '../infrastructure/coach-feedback.repository';
import { buildFeedbackAudit, buildNewFeedback } from '../lib/feedback.builders';
import { FEEDBACK_CREATED_ACTION } from '../model/development.constants';
import type {
  CoachFeedback,
  CoachFeedbackDetail,
  CreateFeedbackCommand,
} from '../model/feedback.types';
import { DevelopmentScopeService } from './development-scope.service';

/**
 * Creates the DRAFT (revision 1) of a coach feedback: the author's private
 * working copy about a member. Validates team/season/membership scope, then
 * writes the record and an audit entry in one transaction. The draft is never
 * player-visible; the coach-only note stays private from creation.
 */
@Injectable()
export class CreateFeedbackUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR_PORT) private readonly idGenerator: IdGeneratorPort,
    private readonly scope: DevelopmentScopeService,
    private readonly repository: CoachFeedbackRepository,
    private readonly audit: AuditRecorderService,
  ) {}

  execute(
    actor: AuthUserIdentity,
    teamId: string,
    command: CreateFeedbackCommand,
  ): Promise<CoachFeedbackDetail> {
    return this.unitOfWork.runInTransaction(tx =>
      this.run(tx, actor, teamId, command),
    );
  }

  private async run(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    command: CreateFeedbackCommand,
  ): Promise<CoachFeedbackDetail> {
    await this.scope.validate(tx, teamId, command.seasonId);
    await this.scope.requireMembership(tx, teamId, command.membershipId);
    const feedback = await this.persist(tx, actor, teamId, command);
    await this.audit.record(
      tx,
      buildFeedbackAudit(FEEDBACK_CREATED_ACTION, actor.userId, feedback),
    );
    return { feedback, acknowledgement: null };
  }

  private persist(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    command: CreateFeedbackCommand,
  ): Promise<CoachFeedback> {
    return this.repository.insertFeedback(
      tx,
      buildNewFeedback(
        this.idGenerator.generate(),
        teamId,
        command,
        actor.userId,
        this.clock.now(),
      ),
    );
  }
}
