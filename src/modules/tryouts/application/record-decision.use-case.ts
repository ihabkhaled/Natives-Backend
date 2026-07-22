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
import {
  candidateTargetOf,
  canTransitionCandidate,
} from '../domain/tryout.state-machine';
import { TryoutInvalidTransitionError } from '../errors/tryout-invalid-transition.error';
import { TryoutVersionConflictError } from '../errors/tryout-version-conflict.error';
import { TryoutCandidateRepository } from '../infrastructure/tryout-candidate.repository';
import { TryoutSelectionRepository } from '../infrastructure/tryout-selection.repository';
import {
  buildCandidateStatusChange,
  buildDecisionAudit,
  buildNewDecision,
} from '../lib/tryouts.builders';
import { TRYOUT_DECISION_RECORDED_ACTION } from '../model/tryouts.constants';
import { CandidateStatus } from '../model/tryouts.enums';
import type {
  RecordDecisionCommand,
  TryoutCandidate,
  TryoutDecision,
} from '../model/tryouts.types';
import { TryoutLookupService } from './tryout-lookup.service';

/**
 * Records the committee's HUMAN decision on a candidate (UN-601).
 *
 * The evaluation aggregate is read only to stamp how many evaluators had
 * submitted when the call was made — it never chooses the outcome. The decision
 * row is append-only (a reconsideration adds a later row rather than editing the
 * verdict) and the candidate's status moves under an optimistic version guard,
 * so two committee members cannot both apply a decision to the same record.
 */
@Injectable()
export class RecordDecisionUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR_PORT) private readonly ids: IdGeneratorPort,
    private readonly lookup: TryoutLookupService,
    private readonly candidates: TryoutCandidateRepository,
    private readonly selection: TryoutSelectionRepository,
    private readonly audit: AuditRecorderService,
  ) {}

  execute(
    actor: AuthUserIdentity,
    teamId: string,
    candidateId: string,
    command: RecordDecisionCommand,
  ): Promise<TryoutDecision> {
    return this.unitOfWork.runInTransaction(tx =>
      this.run(tx, actor, teamId, candidateId, command),
    );
  }

  private async run(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    candidateId: string,
    command: RecordDecisionCommand,
  ): Promise<TryoutDecision> {
    const candidate = await this.lookup.requireCandidate(
      tx,
      teamId,
      candidateId,
    );
    const target = candidateTargetOf(command.decision);
    if (!canTransitionCandidate(candidate.status, target)) {
      throw new TryoutInvalidTransitionError();
    }
    const evaluatorCount = await this.submittedCount(tx, candidateId);
    await this.moveCandidate(tx, candidate, target, command);
    return this.writeDecision(tx, actor, candidate, command, evaluatorCount);
  }

  private async submittedCount(
    tx: TransactionScope,
    candidateId: string,
  ): Promise<number> {
    const evaluations = await this.selection.listEvaluations(tx, candidateId);
    return aggregateEvaluations(candidateId, evaluations).submittedCount;
  }

  private async moveCandidate(
    tx: TransactionScope,
    candidate: TryoutCandidate,
    target: CandidateStatus,
    command: RecordDecisionCommand,
  ): Promise<void> {
    const changed = await this.candidates.applyStatusChange(
      tx,
      buildCandidateStatusChange(
        candidate,
        target,
        command.expectedRecordVersion,
        false,
        target === CandidateStatus.Withdrawn,
        this.clock.now(),
      ),
    );
    if (changed === null) {
      throw new TryoutVersionConflictError();
    }
  }

  private async writeDecision(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    candidate: TryoutCandidate,
    command: RecordDecisionCommand,
    evaluatorCount: number,
  ): Promise<TryoutDecision> {
    const decision = await this.selection.insertDecision(
      tx,
      buildNewDecision(
        this.ids.generate(),
        candidate,
        command.decision,
        command.reasons,
        command.criteriaVersion,
        evaluatorCount,
        actor.userId,
        this.clock.now(),
      ),
    );
    await this.audit.record(
      tx,
      buildDecisionAudit(
        TRYOUT_DECISION_RECORDED_ACTION,
        actor.userId,
        decision,
        null,
      ),
    );
    return decision;
  }
}
