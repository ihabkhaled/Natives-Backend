import type { AuthUserIdentity } from '@core/auth';
import { CLOCK_PORT, type ClockPort } from '@core/clock/clock.port';
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
  canTransitionSquad,
  isLockTarget,
  isPublishTarget,
  isReviseTransition,
  resolveSquadTarget,
} from '../domain/squad.state-machine';
import { SquadInvalidTransitionError } from '../errors/squad-invalid-transition.error';
import { SquadVersionConflictError } from '../errors/squad-version-conflict.error';
import { SquadRepository } from '../infrastructure/squad.repository';
import { SquadSelectionRepository } from '../infrastructure/squad-selection.repository';
import {
  buildSquadAudit,
  buildSquadLockedEvent,
  buildSquadPublishedEvent,
  buildSquadStatusChange,
} from '../lib/squads.builders';
import { SQUAD_TRANSITIONED_ACTION } from '../model/squads.constants';
import { SquadStatus } from '../model/squads.enums';
import type { Squad, TransitionSquadCommand } from '../model/squads.types';
import { SquadLookupService } from './squad-lookup.service';

/**
 * Moves a squad through its DRAFT → PUBLISHED → LOCKED → ARCHIVED lifecycle under
 * an optimistic version guard. Publishing enqueues `squad.published` (the notify
 * signal) and locking `squad.locked`; revising a published/locked squad returns it
 * to DRAFT and bumps its revision so history is preserved. All effects commit in
 * one transaction.
 */
@Injectable()
export class TransitionSquadUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    private readonly lookup: SquadLookupService,
    private readonly repository: SquadRepository,
    private readonly selections: SquadSelectionRepository,
    private readonly audit: AuditRecorderService,
    private readonly events: RecordDomainEventService,
  ) {}

  execute(
    actor: AuthUserIdentity,
    teamId: string,
    squadId: string,
    command: TransitionSquadCommand,
  ): Promise<Squad> {
    return this.unitOfWork.runInTransaction(tx =>
      this.run(tx, actor, teamId, squadId, command),
    );
  }

  private async run(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    squadId: string,
    command: TransitionSquadCommand,
  ): Promise<Squad> {
    const existing = await this.lookup.require(tx, teamId, squadId);
    const target = resolveSquadTarget(command.transition);
    this.assertTransition(existing.status, target);
    const changed = await this.repository.applyStatusChange(
      tx,
      buildSquadStatusChange(
        existing,
        teamId,
        target,
        actor.userId,
        isReviseTransition(existing.status, target),
        command.expectedRecordVersion,
        this.clock.now(),
      ),
    );
    return this.finish(tx, actor, changed);
  }

  private assertTransition(from: SquadStatus, target: SquadStatus): void {
    if (!canTransitionSquad(from, target)) {
      throw new SquadInvalidTransitionError();
    }
  }

  private async finish(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    changed: Squad | null,
  ): Promise<Squad> {
    if (changed === null) {
      throw new SquadVersionConflictError();
    }
    await this.audit.record(
      tx,
      buildSquadAudit(SQUAD_TRANSITIONED_ACTION, actor.userId, changed),
    );
    await this.dispatch(tx, actor, changed);
    return changed;
  }

  private async dispatch(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    squad: Squad,
  ): Promise<void> {
    if (isPublishTarget(squad.status)) {
      const count = await this.selections.countActive(tx, squad.squadId);
      await this.events.enqueue(
        tx,
        buildSquadPublishedEvent(squad, actor.userId, count),
      );
      return;
    }
    if (isLockTarget(squad.status)) {
      const count = await this.selections.countActive(tx, squad.squadId);
      await this.events.enqueue(
        tx,
        buildSquadLockedEvent(squad, actor.userId, count),
      );
    }
  }
}
