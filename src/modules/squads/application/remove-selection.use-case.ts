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

import { isSelectionFrozen } from '../domain/squad.state-machine';
import { SelectionNotFoundError } from '../errors/selection-not-found.error';
import { SquadLockedError } from '../errors/squad-locked.error';
import { SquadSelectionRepository } from '../infrastructure/squad-selection.repository';
import {
  buildSelectionAudit,
  buildSelectionEvent,
  buildSelectionRemoval,
} from '../lib/squads.builders';
import { SELECTION_REMOVED_ACTION } from '../model/squads.constants';
import { SelectionEventType } from '../model/squads.enums';
import type {
  RemoveSelectionCommand,
  Squad,
  SquadSelection,
} from '../model/squads.types';
import { SquadLookupService } from './squad-lookup.service';

/**
 * Removes a player from a squad (squad.manage) with a reason. The selection row is
 * soft-removed — kept for history — and a `removed` history event plus an audit
 * entry are recorded in one transaction. A locked squad is frozen.
 */
@Injectable()
export class RemoveSelectionUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR_PORT) private readonly idGenerator: IdGeneratorPort,
    private readonly lookup: SquadLookupService,
    private readonly selections: SquadSelectionRepository,
    private readonly audit: AuditRecorderService,
  ) {}

  execute(
    actor: AuthUserIdentity,
    teamId: string,
    squadId: string,
    command: RemoveSelectionCommand,
  ): Promise<SquadSelection> {
    return this.unitOfWork.runInTransaction(tx =>
      this.run(tx, actor, teamId, squadId, command),
    );
  }

  private async run(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    squadId: string,
    command: RemoveSelectionCommand,
  ): Promise<SquadSelection> {
    const squad = await this.lookup.require(tx, teamId, squadId);
    if (isSelectionFrozen(squad.status)) {
      throw new SquadLockedError();
    }
    const removed = await this.selections.softRemove(
      tx,
      buildSelectionRemoval(
        squad.squadId,
        command.membershipId,
        actor.userId,
        command.reason,
        this.clock.now(),
      ),
    );
    if (removed === null) {
      throw new SelectionNotFoundError();
    }
    return this.finish(tx, actor, squad, removed, command.reason);
  }

  private async finish(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    squad: Squad,
    removed: SquadSelection,
    reason: string | null,
  ): Promise<SquadSelection> {
    await this.selections.appendEvent(
      tx,
      buildSelectionEvent(
        this.idGenerator.generate(),
        squad.squadId,
        removed.membershipId,
        SelectionEventType.Removed,
        removed.selectionRole,
        reason,
        removed.eligibilitySnapshot,
        actor.userId,
        this.clock.now(),
      ),
    );
    await this.audit.record(
      tx,
      buildSelectionAudit(
        SELECTION_REMOVED_ACTION,
        actor.userId,
        squad,
        removed.membershipId,
        removed.eligibilitySnapshot,
        removed.eligibilityOverridden,
      ),
    );
    return removed;
  }
}
