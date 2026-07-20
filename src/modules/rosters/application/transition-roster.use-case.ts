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
  canTransitionRoster,
  enforcesConstraints,
  isPublishTarget,
  resolveRosterTarget,
} from '../domain/roster.state-machine';
import { resolvePublishAudience } from '../domain/roster-notification.policy';
import { RosterInvalidTransitionError } from '../errors/roster-invalid-transition.error';
import { RosterVersionConflictError } from '../errors/roster-version-conflict.error';
import { RosterRepository } from '../infrastructure/roster.repository';
import { RosterEntryRepository } from '../infrastructure/roster-entry.repository';
import { RosterSourceRepository } from '../infrastructure/roster-source.repository';
import {
  buildRosterAudit,
  buildRosterPublishedEvent,
  buildRosterStatusChange,
} from '../lib/rosters.builders';
import { ROSTER_TRANSITIONED_ACTION } from '../model/rosters.constants';
import { SnapshotReason } from '../model/rosters.enums';
import type { Roster, TransitionRosterCommand } from '../model/rosters.types';
import { RosterLookupService } from './roster-lookup.service';
import { RosterSnapshotRecorderService } from './roster-snapshot-recorder.service';
import { RosterValidationService } from './roster-validation.service';

/**
 * Publishes or archives a roster under an optimistic version guard
 * (roster.manage). Publishing re-runs the SAME composition validation the coach
 * previewed, freezes an immutable snapshot, and enqueues `roster.published` — the
 * notify signal, carrying the privacy-aware audience decision and counts, never a
 * list of who was left out. All effects commit in one transaction. Locking and
 * revising are separately permissioned and live in their own use cases.
 */
@Injectable()
export class TransitionRosterUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    private readonly lookup: RosterLookupService,
    private readonly rosters: RosterRepository,
    private readonly entries: RosterEntryRepository,
    private readonly source: RosterSourceRepository,
    private readonly validation: RosterValidationService,
    private readonly snapshots: RosterSnapshotRecorderService,
    private readonly audit: AuditRecorderService,
    private readonly events: RecordDomainEventService,
  ) {}

  execute(
    actor: AuthUserIdentity,
    teamId: string,
    rosterId: string,
    command: TransitionRosterCommand,
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
    command: TransitionRosterCommand,
  ): Promise<Roster> {
    const existing = await this.lookup.require(tx, teamId, rosterId);
    const target = resolveRosterTarget(command.transition);
    if (!canTransitionRoster(existing.status, target)) {
      throw new RosterInvalidTransitionError();
    }
    if (enforcesConstraints(target)) {
      await this.validation.assertPublishable(tx, existing);
    }
    const changed = await this.rosters.applyStatusChange(
      tx,
      buildRosterStatusChange(
        existing,
        teamId,
        target,
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
    await this.audit.record(
      tx,
      buildRosterAudit(ROSTER_TRANSITIONED_ACTION, actor.userId, changed),
    );
    if (!isPublishTarget(changed.status)) {
      return changed;
    }
    await this.publish(tx, actor, changed);
    return this.lookup.require(tx, changed.teamId, changed.rosterId);
  }

  private async publish(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    roster: Roster,
  ): Promise<void> {
    const snapshot = await this.snapshots.record(
      tx,
      roster,
      SnapshotReason.Published,
      actor.userId,
    );
    const plan = resolvePublishAudience(
      roster.rosterKind,
      await this.entries.countActive(tx, roster.rosterId),
      await this.source.countNotSelected(
        tx,
        roster.teamId,
        roster.seasonId,
        roster.rosterId,
      ),
    );
    await this.events.enqueue(
      tx,
      buildRosterPublishedEvent(
        roster,
        actor.userId,
        plan,
        snapshot.snapshotId,
      ),
    );
  }
}
