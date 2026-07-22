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
  buildPreview,
  canApply,
  canRollback,
  isRepairable,
  repairKindFor,
} from '../domain/repair.policy';
import { DataQualityVersionConflictError } from '../errors/data-quality-version-conflict.error';
import { RepairNotAllowedError } from '../errors/repair-not-allowed.error';
import { AnomalyRepository } from '../infrastructure/anomaly.repository';
import { RepairRepository } from '../infrastructure/repair.repository';
import {
  buildNewRepair,
  buildRepairAudit,
  buildRepairStatusChange,
} from '../lib/dataquality.builders';
import {
  REPAIR_APPLIED_ACTION,
  REPAIR_PREVIEWED_ACTION,
  REPAIR_ROLLED_BACK_ACTION,
  RESOLVED_BY_REPAIR,
} from '../model/dataquality.constants';
import { AnomalyStatus, RepairStatus } from '../model/dataquality.enums';
import type {
  Anomaly,
  Repair,
  RepairPreview,
} from '../model/dataquality.types';
import { DataQualityLookupService } from './dataquality-lookup.service';

/**
 * Previews, applies, and rolls back a repair for an anomaly (UN-705).
 *
 * A repair is ALWAYS previewed first: the preview is read-only and reports the
 * impact and whether the repair is reversible, so an operator sees the
 * consequence before anything changes. Applying and rolling back are guarded
 * lifecycle writes with a recorded rollback reference — a repair runs through
 * this owning service and its audit trail, never a raw SQL sweep, and an
 * irreversible repair (a merge) can never be rolled back.
 */
@Injectable()
export class RepairAnomalyUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR_PORT) private readonly ids: IdGeneratorPort,
    private readonly lookup: DataQualityLookupService,
    private readonly anomalies: AnomalyRepository,
    private readonly repairs: RepairRepository,
    private readonly audit: AuditRecorderService,
  ) {}

  preview(teamId: string, anomalyId: string): Promise<RepairPreview> {
    return this.unitOfWork.runInTransaction(async tx => {
      const anomaly = await this.lookup.requireAnomaly(tx, teamId, anomalyId);
      return this.previewOf(anomaly);
    });
  }

  apply(
    actor: AuthUserIdentity,
    teamId: string,
    anomalyId: string,
  ): Promise<Repair> {
    return this.unitOfWork.runInTransaction(tx =>
      this.runApply(tx, actor, teamId, anomalyId),
    );
  }

  rollback(
    actor: AuthUserIdentity,
    teamId: string,
    anomalyId: string,
  ): Promise<Repair> {
    return this.unitOfWork.runInTransaction(tx =>
      this.runRollback(tx, actor, teamId, anomalyId),
    );
  }

  private previewOf(anomaly: Anomaly): RepairPreview {
    const kind = repairKindFor(anomaly.ruleKey);
    if (kind === null || !isRepairable(anomaly)) {
      throw new RepairNotAllowedError();
    }
    return buildPreview(anomaly, kind);
  }

  private async runApply(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    anomalyId: string,
  ): Promise<Repair> {
    const anomaly = await this.lookup.requireAnomaly(tx, teamId, anomalyId);
    const preview = this.previewOf(anomaly);
    const previewed = await this.repairs.insert(
      tx,
      buildNewRepair(
        this.ids.generate(),
        teamId,
        anomalyId,
        preview.repairKind,
        preview.impactCount,
        preview.impactSummary,
        actor.userId,
        this.clock.now(),
      ),
    );
    await this.audit.record(
      tx,
      buildRepairAudit(REPAIR_PREVIEWED_ACTION, actor.userId, previewed),
    );
    return this.applyPreviewed(tx, actor, anomaly, previewed);
  }

  private async applyPreviewed(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    anomaly: Anomaly,
    previewed: Repair,
  ): Promise<Repair> {
    if (!canApply(previewed.status)) {
      throw new RepairNotAllowedError();
    }
    const applied = await this.repairs.applyStatusChange(
      tx,
      buildRepairStatusChange(
        previewed,
        RepairStatus.Applied,
        `rollback:${previewed.repairId}`,
        true,
        false,
        this.clock.now(),
      ),
    );
    if (applied === null) {
      throw new DataQualityVersionConflictError();
    }
    await this.resolveAnomaly(tx, actor, anomaly);
    await this.audit.record(
      tx,
      buildRepairAudit(REPAIR_APPLIED_ACTION, actor.userId, applied),
    );
    return applied;
  }

  /** An applied repair resolves the anomaly it fixed. */
  private async resolveAnomaly(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    anomaly: Anomaly,
  ): Promise<void> {
    const now = this.clock.now();
    await this.anomalies.applyStatusChange(tx, {
      id: anomaly.anomalyId,
      teamId: anomaly.teamId,
      expectedRecordVersion: anomaly.recordVersion,
      toStatus: AnomalyStatus.Resolved,
      ownerUserId: actor.userId,
      resolution: RESOLVED_BY_REPAIR,
      suppressedUntil: null,
      resolvedAt: now,
      now,
    });
  }

  private async runRollback(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    anomalyId: string,
  ): Promise<Repair> {
    await this.lookup.requireAnomaly(tx, teamId, anomalyId);
    const latest = await this.repairs.findLatestForAnomaly(
      tx,
      teamId,
      anomalyId,
    );
    if (latest === null || !canRollback(latest.status, latest.repairKind)) {
      throw new RepairNotAllowedError();
    }
    const rolledBack = await this.repairs.applyStatusChange(
      tx,
      buildRepairStatusChange(
        latest,
        RepairStatus.RolledBack,
        latest.rollbackRef,
        false,
        true,
        this.clock.now(),
      ),
    );
    if (rolledBack === null) {
      throw new DataQualityVersionConflictError();
    }
    await this.audit.record(
      tx,
      buildRepairAudit(REPAIR_ROLLED_BACK_ACTION, actor.userId, rolledBack),
    );
    return rolledBack;
  }
}
