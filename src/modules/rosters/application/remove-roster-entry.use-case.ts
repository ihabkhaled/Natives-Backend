import type { AuthUserIdentity } from '@core/auth';
import { CLOCK_PORT, type ClockPort } from '@core/clock/clock.port';
import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { AuditRecorderService } from '@modules/platform';
import { Inject, Injectable } from '@nestjs/common';

import { isRosterFrozen } from '../domain/roster.state-machine';
import { RosterEntryNotFoundError } from '../errors/roster-entry-not-found.error';
import { RosterLockedError } from '../errors/roster-locked.error';
import { RosterEntryRepository } from '../infrastructure/roster-entry.repository';
import { buildEntryAudit, buildEntryRemoval } from '../lib/rosters.builders';
import { ROSTER_ENTRY_REMOVED_ACTION } from '../model/rosters.constants';
import type {
  RemoveRosterEntryCommand,
  Roster,
  RosterEntry,
} from '../model/rosters.types';
import { RosterLookupService } from './roster-lookup.service';

/**
 * Removes a player from a roster (roster.manage). Removal is a soft withdrawal:
 * the entry keeps its row, its selector, and its override evidence, so match
 * history is never deleted and an export still lists the player. A frozen roster
 * refuses the change — the way forward is a revision that supersedes it.
 */
@Injectable()
export class RemoveRosterEntryUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    private readonly lookup: RosterLookupService,
    private readonly entries: RosterEntryRepository,
    private readonly audit: AuditRecorderService,
  ) {}

  execute(
    actor: AuthUserIdentity,
    teamId: string,
    rosterId: string,
    command: RemoveRosterEntryCommand,
  ): Promise<RosterEntry> {
    return this.unitOfWork.runInTransaction(tx =>
      this.run(tx, actor, teamId, rosterId, command),
    );
  }

  private async run(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    rosterId: string,
    command: RemoveRosterEntryCommand,
  ): Promise<RosterEntry> {
    const roster = await this.lookup.require(tx, teamId, rosterId);
    if (isRosterFrozen(roster.status)) {
      throw new RosterLockedError();
    }
    const removed = await this.entries.softRemove(
      tx,
      buildEntryRemoval(
        roster.rosterId,
        command.membershipId,
        actor.userId,
        command.reason,
        this.clock.now(),
      ),
    );
    return this.finish(tx, actor, roster, removed);
  }

  private async finish(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    roster: Roster,
    removed: RosterEntry | null,
  ): Promise<RosterEntry> {
    if (removed === null) {
      throw new RosterEntryNotFoundError();
    }
    await this.audit.record(
      tx,
      buildEntryAudit(
        ROSTER_ENTRY_REMOVED_ACTION,
        actor.userId,
        roster,
        removed.membershipId,
        '',
        removed.constraintOverridden,
      ),
    );
    return removed;
  }
}
