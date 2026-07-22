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

import { isConverted, isConvertible } from '../domain/tryout.state-machine';
import { TryoutAlreadyConvertedError } from '../errors/tryout-already-converted.error';
import { TryoutDecisionRequiredError } from '../errors/tryout-decision-required.error';
import { TryoutCandidateRepository } from '../infrastructure/tryout-candidate.repository';
import { TryoutSelectionRepository } from '../infrastructure/tryout-selection.repository';
import {
  buildCandidateAudit,
  buildCandidateConvertedEvent,
} from '../lib/tryouts.builders';
import { TRYOUT_CANDIDATE_CONVERTED_ACTION } from '../model/tryouts.constants';
import type {
  ConversionResult,
  ConvertCandidateCommand,
  TryoutCandidate,
} from '../model/tryouts.types';
import { TryoutLookupService } from './tryout-lookup.service';

/**
 * Converts an accepted candidate into an invited membership — exactly once
 * (UN-601).
 *
 * Three guards make it safe. A human ACCEPT decision plus an ACCEPTED offer are
 * required, so nothing automated can create a member. An existing membership for
 * the same user is REUSED rather than duplicated, so a returning player keeps
 * their history. And the link write is guarded by `converted_at IS NULL` at the
 * database level, so a replayed request returns the same membership with
 * `created: false` instead of creating a second one.
 */
@Injectable()
export class ConvertCandidateUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR_PORT) private readonly ids: IdGeneratorPort,
    private readonly lookup: TryoutLookupService,
    private readonly candidates: TryoutCandidateRepository,
    private readonly selection: TryoutSelectionRepository,
    private readonly audit: AuditRecorderService,
    private readonly events: RecordDomainEventService,
  ) {}

  execute(
    actor: AuthUserIdentity,
    teamId: string,
    candidateId: string,
    command: ConvertCandidateCommand,
  ): Promise<ConversionResult> {
    return this.unitOfWork.runInTransaction(tx =>
      this.run(tx, actor, teamId, candidateId, command),
    );
  }

  private async run(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    candidateId: string,
    command: ConvertCandidateCommand,
  ): Promise<ConversionResult> {
    const candidate = await this.lookup.requireCandidate(
      tx,
      teamId,
      candidateId,
    );
    if (isConverted(candidate.status)) {
      return this.replay(candidate);
    }
    await this.assertEligible(tx, candidate);
    const membershipId = await this.resolveMembership(
      tx,
      actor,
      candidate,
      command,
    );
    return this.link(tx, actor, candidate, membershipId);
  }

  private replay(candidate: TryoutCandidate): ConversionResult {
    if (candidate.convertedMembershipId === null) {
      throw new TryoutAlreadyConvertedError();
    }
    return {
      candidateId: candidate.candidateId,
      membershipId: candidate.convertedMembershipId,
      created: false,
    };
  }

  private async assertEligible(
    tx: TransactionScope,
    candidate: TryoutCandidate,
  ): Promise<void> {
    if (!isConvertible(candidate.status)) {
      throw new TryoutDecisionRequiredError();
    }
    const offer = await this.selection.findAcceptedOffer(
      tx,
      candidate.candidateId,
    );
    if (offer === null) {
      throw new TryoutDecisionRequiredError();
    }
  }

  private async resolveMembership(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    candidate: TryoutCandidate,
    command: ConvertCandidateCommand,
  ): Promise<string> {
    const existing =
      command.userId === null
        ? null
        : await this.selection.findExistingMembership(
            tx,
            candidate.teamId,
            command.userId,
          );
    if (existing !== null) {
      return existing;
    }
    return this.selection.insertMembership(tx, {
      id: this.ids.generate(),
      teamId: candidate.teamId,
      seasonId: command.seasonId,
      userId: command.userId,
      createdBy: actor.userId,
      now: this.clock.now(),
    });
  }

  private async link(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    candidate: TryoutCandidate,
    membershipId: string,
  ): Promise<ConversionResult> {
    const linked = await this.candidates.linkMembership(
      tx,
      candidate.candidateId,
      membershipId,
      this.clock.now(),
    );
    if (linked === null) {
      return this.replay(
        await this.lookup.requireCandidate(
          tx,
          candidate.teamId,
          candidate.candidateId,
        ),
      );
    }
    await this.audit.record(
      tx,
      buildCandidateAudit(
        TRYOUT_CANDIDATE_CONVERTED_ACTION,
        actor.userId,
        linked,
        null,
      ),
    );
    await this.events.enqueue(
      tx,
      buildCandidateConvertedEvent(linked, membershipId, null, actor.userId),
    );
    return {
      candidateId: linked.candidateId,
      membershipId,
      created: true,
    };
  }
}
