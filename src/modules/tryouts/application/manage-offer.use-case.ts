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

import {
  canTransitionOffer,
  isOfferExpired,
  offerTargetOf,
} from '../domain/tryout.state-machine';
import { TryoutInvalidTransitionError } from '../errors/tryout-invalid-transition.error';
import { TryoutVersionConflictError } from '../errors/tryout-version-conflict.error';
import { TryoutSelectionRepository } from '../infrastructure/tryout-selection.repository';
import {
  buildCandidateAudit,
  buildNewOffer,
  buildOfferSentEvent,
  buildOfferStatusChange,
} from '../lib/tryouts.builders';
import {
  MILLISECONDS_PER_DAY,
  OFFER_TTL_DAYS_DEFAULT,
  TRYOUT_OFFER_TRANSITIONED_ACTION,
} from '../model/tryouts.constants';
import { OfferStatus } from '../model/tryouts.enums';
import type {
  ManageOfferCommand,
  TryoutCandidate,
  TryoutOffer,
} from '../model/tryouts.types';
import { TryoutLookupService } from './tryout-lookup.service';

/**
 * Creates and moves a candidate-facing offer (UN-601).
 *
 * There is at most one LIVE offer per candidate (enforced by a partial unique
 * index), so a send race cannot produce two competing offers. An offer whose
 * deadline has passed can only be EXPIRED — accepting a stale offer is refused
 * rather than honoured, which is the race the expiry exists to settle. The sent
 * event carries the candidate id and the expiry only: never the ratings, the
 * committee's reasons, or any internal note.
 */
@Injectable()
export class ManageOfferUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR_PORT) private readonly ids: IdGeneratorPort,
    private readonly lookup: TryoutLookupService,
    private readonly selection: TryoutSelectionRepository,
    private readonly audit: AuditRecorderService,
    private readonly events: RecordDomainEventService,
  ) {}

  execute(
    actor: AuthUserIdentity,
    teamId: string,
    candidateId: string,
    command: ManageOfferCommand,
  ): Promise<TryoutOffer> {
    return this.unitOfWork.runInTransaction(tx =>
      this.run(tx, actor, teamId, candidateId, command),
    );
  }

  private async run(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    candidateId: string,
    command: ManageOfferCommand,
  ): Promise<TryoutOffer> {
    const candidate = await this.lookup.requireCandidate(
      tx,
      teamId,
      candidateId,
    );
    const offer = await this.resolveOffer(tx, actor, candidate, command);
    const target = offerTargetOf(command.transition);
    this.assertLegal(offer, target);
    return this.applyChange(tx, actor, candidate, offer, target, command);
  }

  private async resolveOffer(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    candidate: TryoutCandidate,
    command: ManageOfferCommand,
  ): Promise<TryoutOffer> {
    const live = await this.selection.findLiveOffer(tx, candidate.candidateId);
    if (live !== null) {
      return live;
    }
    const now = this.clock.now();
    return this.selection.insertOffer(
      tx,
      buildNewOffer(
        this.ids.generate(),
        candidate,
        command.candidateMessage,
        new Date(now.getTime() + OFFER_TTL_DAYS_DEFAULT * MILLISECONDS_PER_DAY),
        actor.userId,
        now,
      ),
    );
  }

  private assertLegal(offer: TryoutOffer, target: OfferStatus): void {
    if (!canTransitionOffer(offer.status, target)) {
      throw new TryoutInvalidTransitionError();
    }
    if (this.isStaleAcceptance(offer, target)) {
      throw new TryoutInvalidTransitionError();
    }
  }

  /** An expired offer may be marked expired, never accepted or declined. */
  private isStaleAcceptance(offer: TryoutOffer, target: OfferStatus): boolean {
    if (target === OfferStatus.Expired || target === OfferStatus.Withdrawn) {
      return false;
    }
    return isOfferExpired(offer.expiresAt, this.clock.now());
  }

  private async applyChange(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    candidate: TryoutCandidate,
    offer: TryoutOffer,
    target: OfferStatus,
    command: ManageOfferCommand,
  ): Promise<TryoutOffer> {
    const changed = await this.selection.applyOfferStatusChange(
      tx,
      buildOfferStatusChange(
        offer,
        target,
        command.expectedRecordVersion,
        target === OfferStatus.Sent,
        this.isResponse(target),
        this.clock.now(),
      ),
    );
    if (changed === null) {
      throw new TryoutVersionConflictError();
    }
    return this.finish(tx, actor, candidate, changed);
  }

  private isResponse(target: OfferStatus): boolean {
    return (
      target === OfferStatus.Accepted ||
      target === OfferStatus.Declined ||
      target === OfferStatus.Expired
    );
  }

  private async finish(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    candidate: TryoutCandidate,
    changed: TryoutOffer,
  ): Promise<TryoutOffer> {
    await this.audit.record(
      tx,
      buildCandidateAudit(
        TRYOUT_OFFER_TRANSITIONED_ACTION,
        actor.userId,
        candidate,
        null,
      ),
    );
    if (changed.status === OfferStatus.Sent) {
      await this.events.enqueue(
        tx,
        buildOfferSentEvent(changed, null, actor.userId),
      );
    }
    return changed;
  }
}
