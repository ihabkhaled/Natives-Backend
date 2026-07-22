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

import { aggregateEvaluations } from '../domain/evaluation-aggregation.policy';
import { TryoutSelectionRepository } from '../infrastructure/tryout-selection.repository';
import {
  buildCandidateAudit,
  buildEvaluationUpsert,
} from '../lib/tryouts.builders';
import { TRYOUT_EVALUATION_SUBMITTED_ACTION } from '../model/tryouts.constants';
import type {
  EvaluationAggregate,
  SubmitEvaluationCommand,
  TryoutEvaluation,
} from '../model/tryouts.types';
import { TryoutLookupService } from './tryout-lookup.service';

/**
 * Records ONE evaluator's original observation of a candidate (UN-601).
 *
 * The upsert is keyed by (candidate, evaluator), so an evaluator revises their
 * own original and can never overwrite a colleague's. Ratings are sanitized —
 * an out-of-range value is dropped, never clamped into a score — and the private
 * notes stay on the row, out of the aggregate and out of the audit diff.
 */
@Injectable()
export class SubmitEvaluationUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR_PORT) private readonly ids: IdGeneratorPort,
    private readonly lookup: TryoutLookupService,
    private readonly selection: TryoutSelectionRepository,
    private readonly audit: AuditRecorderService,
  ) {}

  execute(
    actor: AuthUserIdentity,
    teamId: string,
    candidateId: string,
    command: SubmitEvaluationCommand,
  ): Promise<TryoutEvaluation> {
    return this.unitOfWork.runInTransaction(tx =>
      this.run(tx, actor, teamId, candidateId, command),
    );
  }

  /** The read-only aggregate of every evaluator's original for a candidate. */
  aggregate(teamId: string, candidateId: string): Promise<EvaluationAggregate> {
    return this.unitOfWork.runInTransaction(async tx => {
      await this.lookup.requireCandidate(tx, teamId, candidateId);
      return aggregateEvaluations(
        candidateId,
        await this.selection.listEvaluations(tx, candidateId),
      );
    });
  }

  private async run(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    candidateId: string,
    command: SubmitEvaluationCommand,
  ): Promise<TryoutEvaluation> {
    const candidate = await this.lookup.requireCandidate(
      tx,
      teamId,
      candidateId,
    );
    const evaluation = await this.selection.upsertEvaluation(
      tx,
      buildEvaluationUpsert(
        this.ids.generate(),
        candidate,
        actor.userId,
        command.content,
        this.clock.now(),
      ),
    );
    await this.audit.record(
      tx,
      buildCandidateAudit(
        TRYOUT_EVALUATION_SUBMITTED_ACTION,
        actor.userId,
        candidate,
        null,
      ),
    );
    return evaluation;
  }
}
