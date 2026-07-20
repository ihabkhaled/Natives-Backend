import { CLOCK_PORT, type ClockPort } from '@core/clock/clock.port';
import {
  ID_GENERATOR_PORT,
  type IdGeneratorPort,
} from '@core/id-generator/id-generator.port';
import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { AuditRecorderService } from '@modules/platform';
import { Inject, Injectable } from '@nestjs/common';

import { assertSnapshotWritable } from '../domain/roster-snapshot.policy';
import { RosterRepository } from '../infrastructure/roster.repository';
import { RosterEntryRepository } from '../infrastructure/roster-entry.repository';
import { RosterSnapshotRepository } from '../infrastructure/roster-snapshot.repository';
import {
  buildRosterSnapshot,
  toSnapshotEntries,
} from '../lib/roster-snapshot.factory';
import { buildSnapshotAudit } from '../lib/rosters.builders';
import type { SnapshotReason } from '../model/rosters.enums';
import type {
  NewRosterSnapshot,
  Roster,
  RosterSnapshot,
} from '../model/rosters.types';

/**
 * Freezes a roster into an immutable point-in-time record. Called inside the
 * caller's transaction so the snapshot commits atomically with the lifecycle
 * change it records.
 *
 * A snapshot is written ONCE per roster revision and reason: re-recording one is
 * refused as a rewrite of history. Later squad or roster changes never touch it —
 * they produce a NEW revision with its own snapshot instead.
 */
@Injectable()
export class RosterSnapshotRecorderService {
  constructor(
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR_PORT) private readonly idGenerator: IdGeneratorPort,
    private readonly rosters: RosterRepository,
    private readonly entries: RosterEntryRepository,
    private readonly snapshots: RosterSnapshotRepository,
    private readonly audit: AuditRecorderService,
  ) {}

  async record(
    tx: TransactionScope,
    roster: Roster,
    reason: SnapshotReason,
    actorUserId: string,
  ): Promise<RosterSnapshot> {
    await this.assertUnwritten(tx, roster, reason);
    const written = await this.snapshots.append(
      tx,
      await this.build(tx, roster, reason, actorUserId),
    );
    return this.finish(tx, written, actorUserId);
  }

  private async assertUnwritten(
    tx: TransactionScope,
    roster: Roster,
    reason: SnapshotReason,
  ): Promise<void> {
    assertSnapshotWritable(
      await this.snapshots.findByRevisionReason(
        tx,
        roster.rosterId,
        roster.revision,
        reason,
      ),
    );
  }

  private async build(
    tx: TransactionScope,
    roster: Roster,
    reason: SnapshotReason,
    actorUserId: string,
  ): Promise<NewRosterSnapshot> {
    const entries = await this.entries.listActive(tx, roster.rosterId);
    return buildRosterSnapshot(
      this.idGenerator.generate(),
      roster,
      reason,
      toSnapshotEntries(entries),
      actorUserId,
      this.clock.now(),
    );
  }

  private async finish(
    tx: TransactionScope,
    snapshot: RosterSnapshot,
    actorUserId: string,
  ): Promise<RosterSnapshot> {
    await this.rosters.attachSnapshot(
      tx,
      snapshot.rosterId,
      snapshot.snapshotId,
      this.clock.now(),
    );
    await this.audit.record(tx, buildSnapshotAudit(actorUserId, snapshot));
    return snapshot;
  }
}
