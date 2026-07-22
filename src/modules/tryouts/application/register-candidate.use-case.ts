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

import {
  evaluateRegistration,
  retentionExpiryOf,
} from '../domain/tryout-registration.policy';
import { TryoutConsentError } from '../errors/tryout-consent.error';
import { TryoutDuplicateError } from '../errors/tryout-duplicate.error';
import { TryoutRegistrationRefusedError } from '../errors/tryout-registration-refused.error';
import { TryoutCandidateRepository } from '../infrastructure/tryout-candidate.repository';
import {
  buildCandidateAudit,
  buildNewCandidate,
} from '../lib/tryouts.builders';
import { identityHash } from '../lib/tryouts.helpers';
import {
  MILLISECONDS_PER_DAY,
  TRYOUT_CANDIDATE_REGISTERED_ACTION,
} from '../model/tryouts.constants';
import { RegistrationRefusal } from '../model/tryouts.enums';
import type {
  RegisterCandidateCommand,
  RegistrationVerdict,
  TryoutCandidate,
  TryoutEvent,
} from '../model/tryouts.types';
import { TryoutLookupService } from './tryout-lookup.service';

/**
 * Registers a candidate for a tryout event (UN-600).
 *
 * A candidate is NOT a user and NOT a member — nothing here touches identity or
 * membership. The registration is refused when the event is not open, the window
 * has passed, or the accepted consent version is not the one this event
 * requires; a full event WAITLISTS rather than refuses. Duplicate detection uses
 * a one-way fingerprint of the name and contact, so the same person cannot
 * register twice without the system storing a second searchable copy of them.
 * The retention deadline is stamped at registration, not left to a later job.
 */
@Injectable()
export class RegisterCandidateUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR_PORT) private readonly ids: IdGeneratorPort,
    private readonly lookup: TryoutLookupService,
    private readonly candidates: TryoutCandidateRepository,
    private readonly audit: AuditRecorderService,
  ) {}

  execute(
    actor: AuthUserIdentity | null,
    teamId: string,
    command: RegisterCandidateCommand,
  ): Promise<TryoutCandidate> {
    return this.unitOfWork.runInTransaction(tx =>
      this.run(tx, actor, teamId, command),
    );
  }

  private async run(
    tx: TransactionScope,
    actor: AuthUserIdentity | null,
    teamId: string,
    command: RegisterCandidateCommand,
  ): Promise<TryoutCandidate> {
    const event = await this.lookup.requireEvent(
      tx,
      teamId,
      command.content.eventId,
    );
    const seated = await this.candidates.countSeated(tx, event.eventId);
    const verdict = evaluateRegistration(
      event,
      command.content.consentVersion,
      seated,
      this.clock.now(),
    );
    this.assertAccepted(verdict);
    await this.assertNotDuplicate(tx, event, command);
    return this.write(tx, actor, event, command, verdict, seated);
  }

  private assertAccepted(verdict: RegistrationVerdict): void {
    if (verdict.accepted) {
      return;
    }
    if (verdict.refusal === RegistrationRefusal.ConsentVersionMismatch) {
      throw new TryoutConsentError();
    }
    throw new TryoutRegistrationRefusedError();
  }

  private async assertNotDuplicate(
    tx: TransactionScope,
    event: TryoutEvent,
    command: RegisterCandidateCommand,
  ): Promise<void> {
    const existing = await this.candidates.findByIdentityHash(
      tx,
      event.eventId,
      this.fingerprintOf(event, command),
    );
    if (existing !== null) {
      throw new TryoutDuplicateError();
    }
  }

  private fingerprintOf(
    event: TryoutEvent,
    command: RegisterCandidateCommand,
  ): string {
    return identityHash(
      event.eventId,
      command.content.displayName,
      command.content.contactReference,
    );
  }

  private async write(
    tx: TransactionScope,
    actor: AuthUserIdentity | null,
    event: TryoutEvent,
    command: RegisterCandidateCommand,
    verdict: RegistrationVerdict,
    seated: number,
  ): Promise<TryoutCandidate> {
    const now = this.clock.now();
    const candidate = await this.candidates.insert(
      tx,
      buildNewCandidate(
        this.ids.generate(),
        event,
        command.content,
        this.fingerprintOf(event, command),
        verdict,
        seated,
        retentionExpiryOf(event, now, MILLISECONDS_PER_DAY),
        actor === null ? null : actor.userId,
        now,
      ),
    );
    await this.audit.record(
      tx,
      buildCandidateAudit(
        TRYOUT_CANDIDATE_REGISTERED_ACTION,
        actor === null ? null : actor.userId,
        candidate,
        event.seasonId,
      ),
    );
    return candidate;
  }
}
