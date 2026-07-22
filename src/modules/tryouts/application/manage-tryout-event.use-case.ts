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
  canTransitionEvent,
  eventTargetOf,
} from '../domain/tryout.state-machine';
import { TryoutInvalidTransitionError } from '../errors/tryout-invalid-transition.error';
import { TryoutVersionConflictError } from '../errors/tryout-version-conflict.error';
import { TryoutEventRepository } from '../infrastructure/tryout-event.repository';
import {
  buildEventAudit,
  buildEventStatusChange,
  buildNewTryoutEvent,
} from '../lib/tryouts.builders';
import {
  TRYOUT_EVENT_CREATED_ACTION,
  TRYOUT_EVENT_TRANSITIONED_ACTION,
} from '../model/tryouts.constants';
import type {
  CreateTryoutEventCommand,
  TransitionTryoutEventCommand,
  TryoutEvent,
} from '../model/tryouts.types';
import { TryoutLookupService } from './tryout-lookup.service';

/**
 * Creates and moves tryout events through their lifecycle (UN-600). The season
 * scope is verified server-side, the state machine decides what is legal, and
 * the optimistic record version decides who wins a race. An event starts as a
 * DRAFT — registration is impossible until it is explicitly opened, which is
 * what keeps a half-written event off a public page.
 */
@Injectable()
export class ManageTryoutEventUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR_PORT) private readonly ids: IdGeneratorPort,
    private readonly lookup: TryoutLookupService,
    private readonly events: TryoutEventRepository,
    private readonly audit: AuditRecorderService,
  ) {}

  create(
    actor: AuthUserIdentity,
    teamId: string,
    command: CreateTryoutEventCommand,
  ): Promise<TryoutEvent> {
    return this.unitOfWork.runInTransaction(tx =>
      this.runCreate(tx, actor, teamId, command),
    );
  }

  transition(
    actor: AuthUserIdentity,
    teamId: string,
    eventId: string,
    command: TransitionTryoutEventCommand,
  ): Promise<TryoutEvent> {
    return this.unitOfWork.runInTransaction(tx =>
      this.runTransition(tx, actor, teamId, eventId, command),
    );
  }

  private async runCreate(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    command: CreateTryoutEventCommand,
  ): Promise<TryoutEvent> {
    await this.lookup.requireScope(tx, teamId, command.content.seasonId);
    const event = await this.events.insert(
      tx,
      buildNewTryoutEvent(
        this.ids.generate(),
        teamId,
        command.content,
        actor.userId,
        this.clock.now(),
      ),
    );
    await this.audit.record(
      tx,
      buildEventAudit(TRYOUT_EVENT_CREATED_ACTION, actor.userId, event),
    );
    return event;
  }

  private async runTransition(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    eventId: string,
    command: TransitionTryoutEventCommand,
  ): Promise<TryoutEvent> {
    const existing = await this.lookup.requireEvent(tx, teamId, eventId);
    const target = eventTargetOf(command.transition);
    if (!canTransitionEvent(existing.status, target)) {
      throw new TryoutInvalidTransitionError();
    }
    const changed = await this.events.applyStatusChange(
      tx,
      buildEventStatusChange(
        existing,
        target,
        command.expectedRecordVersion,
        this.clock.now(),
      ),
    );
    if (changed === null) {
      throw new TryoutVersionConflictError();
    }
    await this.audit.record(
      tx,
      buildEventAudit(TRYOUT_EVENT_TRANSITIONED_ACTION, actor.userId, changed),
    );
    return changed;
  }
}
