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

import { PointsAdjustmentConflictError } from '../errors/points-adjustment-conflict.error';
import { PointsLedgerRepository } from '../infrastructure/points-ledger.repository';
import {
  buildAdjustmentEntry,
  buildLedgerAudit,
  buildPointsAdjustedEvent,
} from '../lib/points.builders';
import { POINTS_ADJUSTED_ACTION } from '../model/points.constants';
import type {
  AdjustmentCommand,
  LedgerEntry,
  PointsSummaryView,
} from '../model/points.types';
import { BadgeSyncService } from './badge-sync.service';
import { PointsScopeService } from './points-scope.service';
import { PointsSummaryService } from './points-summary.service';

/**
 * Records a manual administrative points adjustment (points.adjust). The scope and
 * membership are validated, one immutable MANUAL_ADJUSTMENT row is appended
 * (idempotent by the client operation key — a retry raises 409, never a double
 * credit), badges re-sync, and the change is audited and published in one
 * transaction. The reason is mandatory; the actor comes from the token.
 */
@Injectable()
export class CreateAdjustmentUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR_PORT) private readonly idGenerator: IdGeneratorPort,
    private readonly scope: PointsScopeService,
    private readonly ledger: PointsLedgerRepository,
    private readonly badges: BadgeSyncService,
    private readonly summary: PointsSummaryService,
    private readonly audit: AuditRecorderService,
    private readonly events: RecordDomainEventService,
  ) {}

  execute(
    actor: AuthUserIdentity,
    teamId: string,
    membershipId: string,
    command: AdjustmentCommand,
  ): Promise<PointsSummaryView> {
    return this.unitOfWork.runInTransaction(tx =>
      this.run(tx, actor, teamId, membershipId, command),
    );
  }

  private async run(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    membershipId: string,
    command: AdjustmentCommand,
  ): Promise<PointsSummaryView> {
    await this.scope.validate(tx, teamId, null);
    await this.scope.requireMembership(tx, teamId, membershipId);
    const entry = await this.ledger.insert(
      tx,
      buildAdjustmentEntry(
        this.idGenerator.generate(),
        teamId,
        membershipId,
        command,
        actor.userId,
        this.clock.now(),
      ),
    );
    if (entry === null) {
      throw new PointsAdjustmentConflictError();
    }
    await this.finish(tx, actor, membershipId, entry);
    return this.summary.assemble(tx, teamId, membershipId);
  }

  private async finish(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    membershipId: string,
    entry: LedgerEntry,
  ): Promise<void> {
    await this.badges.sync(
      tx,
      { teamId: entry.teamId, membershipId, actorUserId: actor.userId },
      this.clock.now(),
    );
    await this.audit.record(
      tx,
      buildLedgerAudit(POINTS_ADJUSTED_ACTION, actor.userId, entry),
    );
    await this.events.enqueue(tx, buildPointsAdjustedEvent(entry));
  }
}
