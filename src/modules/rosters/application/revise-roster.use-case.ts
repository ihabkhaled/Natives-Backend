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

import { isRevisable } from '../domain/roster.state-machine';
import {
  carryForwardEntries,
  nextRevision,
} from '../domain/roster-snapshot.policy';
import { RosterInvalidTransitionError } from '../errors/roster-invalid-transition.error';
import { RosterVersionConflictError } from '../errors/roster-version-conflict.error';
import { RosterRepository } from '../infrastructure/roster.repository';
import { RosterEntryRepository } from '../infrastructure/roster-entry.repository';
import {
  buildCarriedEntryWrite,
  buildRosterAudit,
  buildRosterRevisedEvent,
  buildRosterStatusChange,
  buildSuccessorRoster,
} from '../lib/rosters.builders';
import { ROSTER_REVISED_ACTION } from '../model/rosters.constants';
import { RosterStatus, SnapshotReason } from '../model/rosters.enums';
import type {
  ReviseRosterCommand,
  Roster,
  RosterSnapshot,
} from '../model/rosters.types';
import { RosterLookupService } from './roster-lookup.service';
import { RosterSnapshotRecorderService } from './roster-snapshot-recorder.service';

/**
 * Supersedes a published or locked roster with a new DRAFT revision
 * (roster.manage + roster.lock — reopening a frozen record is the same authority
 * as freezing it). Nothing is edited in place: a REVISED snapshot is taken, the
 * superseded roster is stamped `revised` with its mandatory reason, and a NEW
 * roster carrying the next revision number starts from exactly what was frozen —
 * never from a re-derived squad selection. The old roster, its entries, and every
 * snapshot it produced stay readable forever.
 */
@Injectable()
export class ReviseRosterUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR_PORT) private readonly idGenerator: IdGeneratorPort,
    private readonly lookup: RosterLookupService,
    private readonly rosters: RosterRepository,
    private readonly entries: RosterEntryRepository,
    private readonly snapshots: RosterSnapshotRecorderService,
    private readonly audit: AuditRecorderService,
    private readonly events: RecordDomainEventService,
  ) {}

  execute(
    actor: AuthUserIdentity,
    teamId: string,
    rosterId: string,
    command: ReviseRosterCommand,
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
    command: ReviseRosterCommand,
  ): Promise<Roster> {
    const existing = await this.lookup.require(tx, teamId, rosterId);
    if (!isRevisable(existing.status)) {
      throw new RosterInvalidTransitionError();
    }
    const snapshot = await this.snapshots.record(
      tx,
      existing,
      SnapshotReason.Revised,
      actor.userId,
    );
    const superseded = await this.supersede(tx, actor, existing, command);
    return this.createSuccessor(tx, actor, superseded, snapshot);
  }

  private async supersede(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    existing: Roster,
    command: ReviseRosterCommand,
  ): Promise<Roster> {
    const changed = await this.rosters.applyStatusChange(
      tx,
      buildRosterStatusChange(
        existing,
        existing.teamId,
        RosterStatus.Revised,
        actor.userId,
        command.expectedRecordVersion,
        command.reason,
        this.clock.now(),
      ),
    );
    if (changed === null) {
      throw new RosterVersionConflictError();
    }
    return changed;
  }

  private async createSuccessor(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    superseded: Roster,
    snapshot: RosterSnapshot,
  ): Promise<Roster> {
    const successor = await this.rosters.insert(
      tx,
      buildSuccessorRoster(
        this.idGenerator.generate(),
        superseded,
        nextRevision(superseded.revision),
        actor.userId,
        this.clock.now(),
      ),
    );
    await this.carryForward(tx, actor, successor, snapshot);
    return this.finish(tx, actor, superseded, successor, snapshot.snapshotId);
  }

  private async carryForward(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    successor: Roster,
    snapshot: RosterSnapshot,
  ): Promise<void> {
    const frozen = carryForwardEntries(snapshot);
    for (const entry of frozen) {
      await this.entries.upsert(
        tx,
        buildCarriedEntryWrite(
          this.idGenerator.generate(),
          successor.rosterId,
          successor.teamId,
          entry,
          actor.userId,
          this.clock.now(),
        ),
      );
    }
  }

  private async finish(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    superseded: Roster,
    successor: Roster,
    snapshotId: string,
  ): Promise<Roster> {
    await this.audit.record(
      tx,
      buildRosterAudit(ROSTER_REVISED_ACTION, actor.userId, successor),
    );
    await this.events.enqueue(
      tx,
      buildRosterRevisedEvent(
        superseded,
        successor.rosterId,
        actor.userId,
        snapshotId,
      ),
    );
    return successor;
  }
}
