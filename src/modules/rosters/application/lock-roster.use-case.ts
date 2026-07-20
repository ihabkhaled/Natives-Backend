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

import { canTransitionRoster } from '../domain/roster.state-machine';
import { RosterInvalidTransitionError } from '../errors/roster-invalid-transition.error';
import { RosterVersionConflictError } from '../errors/roster-version-conflict.error';
import { RosterRepository } from '../infrastructure/roster.repository';
import {
  buildRosterAudit,
  buildRosterLockedEvent,
  buildRosterStatusChange,
} from '../lib/rosters.builders';
import { ROSTER_LOCKED_ACTION } from '../model/rosters.constants';
import { RosterStatus, SnapshotReason } from '../model/rosters.enums';
import type { LockRosterCommand, Roster } from '../model/rosters.types';
import { RosterLookupService } from './roster-lookup.service';
import { RosterSnapshotRecorderService } from './roster-snapshot-recorder.service';
import { RosterValidationService } from './roster-validation.service';

/**
 * Freezes a published roster (roster.lock — a higher authority than managing a
 * draft). Locking re-validates the composition, writes the immutable LOCKED
 * snapshot that matches are played against, and enqueues `roster.locked`. From
 * here the selection cannot change: a later squad edit leaves both the roster and
 * its snapshot untouched, and correcting the selection means creating a revision
 * that supersedes this one.
 */
@Injectable()
export class LockRosterUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    private readonly lookup: RosterLookupService,
    private readonly rosters: RosterRepository,
    private readonly validation: RosterValidationService,
    private readonly snapshots: RosterSnapshotRecorderService,
    private readonly audit: AuditRecorderService,
    private readonly events: RecordDomainEventService,
  ) {}

  execute(
    actor: AuthUserIdentity,
    teamId: string,
    rosterId: string,
    command: LockRosterCommand,
  ): Promise<Roster> {
    return this.unitOfWork.runInTransaction(tx =>
      this.run(tx, actor, teamId, rosterId, command),
    );
  }

  private async run(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    rosterId: string,
    command: LockRosterCommand,
  ): Promise<Roster> {
    const existing = await this.lookup.require(tx, teamId, rosterId);
    if (!canTransitionRoster(existing.status, RosterStatus.Locked)) {
      throw new RosterInvalidTransitionError();
    }
    await this.validation.assertPublishable(tx, existing);
    const changed = await this.rosters.applyStatusChange(
      tx,
      buildRosterStatusChange(
        existing,
        teamId,
        RosterStatus.Locked,
        actor.userId,
        command.expectedRecordVersion,
        null,
        this.clock.now(),
      ),
    );
    return this.finish(tx, actor, changed);
  }

  private async finish(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    changed: Roster | null,
  ): Promise<Roster> {
    if (changed === null) {
      throw new RosterVersionConflictError();
    }
    const snapshot = await this.snapshots.record(
      tx,
      changed,
      SnapshotReason.Locked,
      actor.userId,
    );
    await this.audit.record(
      tx,
      buildRosterAudit(ROSTER_LOCKED_ACTION, actor.userId, changed),
    );
    await this.events.enqueue(
      tx,
      buildRosterLockedEvent(
        changed,
        actor.userId,
        snapshot.snapshotId,
        snapshot.entryCount,
      ),
    );
    return this.lookup.require(tx, changed.teamId, changed.rosterId);
  }
}
