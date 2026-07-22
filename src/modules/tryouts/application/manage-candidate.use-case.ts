import type { AuthUserIdentity } from '@core/auth';
import { CLOCK_PORT, type ClockPort } from '@core/clock/clock.port';
import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { AuditRecorderService } from '@modules/platform';
import { Inject, Injectable } from '@nestjs/common';

import {
  anonymizeCandidate,
  isRetentionExpired,
} from '../domain/candidate-privacy.policy';
import { canTransitionCandidate } from '../domain/tryout.state-machine';
import { TryoutInvalidTransitionError } from '../errors/tryout-invalid-transition.error';
import { TryoutVersionConflictError } from '../errors/tryout-version-conflict.error';
import { TryoutCandidateRepository } from '../infrastructure/tryout-candidate.repository';
import {
  buildCandidateAudit,
  buildCandidateStatusChange,
} from '../lib/tryouts.builders';
import {
  TRYOUT_CANDIDATE_ANONYMIZED_ACTION,
  TRYOUT_CANDIDATE_CHECKED_IN_ACTION,
  TRYOUT_CANDIDATE_WITHDRAWN_ACTION,
} from '../model/tryouts.constants';
import { CandidateStatus } from '../model/tryouts.enums';
import type {
  RetentionReport,
  TryoutCandidate,
  WithdrawCandidateCommand,
} from '../model/tryouts.types';
import { TryoutLookupService } from './tryout-lookup.service';

/**
 * Attendance, withdrawal, and retention for tryout candidates (UN-600).
 *
 * Check-in and withdrawal are ordinary guarded lifecycle moves. The retention
 * sweep is the privacy obligation: once a candidate's retention window has
 * elapsed, every free-text personal field is overwritten in place and the
 * contact is dropped, while the ROW survives so the funnel statistics stay
 * truthful. Anonymization is one-way and idempotent — a second sweep finds
 * nothing left to do.
 */
@Injectable()
export class ManageCandidateUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    private readonly lookup: TryoutLookupService,
    private readonly candidates: TryoutCandidateRepository,
    private readonly audit: AuditRecorderService,
  ) {}

  checkIn(
    actor: AuthUserIdentity,
    teamId: string,
    candidateId: string,
    expectedRecordVersion: number,
  ): Promise<TryoutCandidate> {
    return this.unitOfWork.runInTransaction(tx =>
      this.move(
        tx,
        actor,
        teamId,
        candidateId,
        CandidateStatus.CheckedIn,
        expectedRecordVersion,
        TRYOUT_CANDIDATE_CHECKED_IN_ACTION,
      ),
    );
  }

  withdraw(
    actor: AuthUserIdentity,
    teamId: string,
    candidateId: string,
    command: WithdrawCandidateCommand,
  ): Promise<TryoutCandidate> {
    return this.unitOfWork.runInTransaction(tx =>
      this.move(
        tx,
        actor,
        teamId,
        candidateId,
        CandidateStatus.Withdrawn,
        command.expectedRecordVersion,
        TRYOUT_CANDIDATE_WITHDRAWN_ACTION,
      ),
    );
  }

  runRetention(
    actor: AuthUserIdentity,
    teamId: string,
  ): Promise<RetentionReport> {
    return this.unitOfWork.runInTransaction(tx =>
      this.sweep(tx, actor, teamId),
    );
  }

  private async move(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    candidateId: string,
    target: CandidateStatus,
    expectedRecordVersion: number,
    action: string,
  ): Promise<TryoutCandidate> {
    const existing = await this.lookup.requireCandidate(
      tx,
      teamId,
      candidateId,
    );
    if (!canTransitionCandidate(existing.status, target)) {
      throw new TryoutInvalidTransitionError();
    }
    const changed = await this.candidates.applyStatusChange(
      tx,
      buildCandidateStatusChange(
        existing,
        target,
        expectedRecordVersion,
        target === CandidateStatus.CheckedIn,
        target === CandidateStatus.Withdrawn,
        this.clock.now(),
      ),
    );
    if (changed === null) {
      throw new TryoutVersionConflictError();
    }
    await this.audit.record(
      tx,
      buildCandidateAudit(action, actor.userId, changed, null),
    );
    return changed;
  }

  private async sweep(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
  ): Promise<RetentionReport> {
    const now = this.clock.now();
    const expired = await this.candidates.listExpired(tx, teamId, now);
    const anonymized: string[] = [];
    for (const candidate of expired) {
      if (await this.anonymizeOne(tx, actor, candidate, now)) {
        anonymized.push(candidate.candidateId);
      }
    }
    return {
      examined: expired.length,
      anonymized: anonymized.length,
      candidateIds: anonymized,
    };
  }

  private async anonymizeOne(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    candidate: TryoutCandidate,
    now: Date,
  ): Promise<boolean> {
    if (!isRetentionExpired(candidate, now)) {
      return false;
    }
    if (!(await this.candidates.anonymize(tx, candidate.candidateId, now))) {
      return false;
    }
    await this.audit.record(
      tx,
      buildCandidateAudit(
        TRYOUT_CANDIDATE_ANONYMIZED_ACTION,
        actor.userId,
        anonymizeCandidate(candidate, now),
        null,
      ),
    );
    return true;
  }
}
