import type { AuthUserIdentity } from '@core/auth';
import { CLOCK_PORT, type ClockPort } from '@core/clock/clock.port';
import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { AuditRecorderService } from '@modules/platform';
import { Inject, Injectable } from '@nestjs/common';

import {
  anomalyTargetOf,
  canTransitionAnomaly,
} from '../domain/anomaly.state-machine';
import { AnomalyInvalidTransitionError } from '../errors/anomaly-invalid-transition.error';
import { DataQualityVersionConflictError } from '../errors/data-quality-version-conflict.error';
import { AnomalyRepository } from '../infrastructure/anomaly.repository';
import {
  buildAnomalyAudit,
  buildAnomalyStatusChange,
} from '../lib/dataquality.builders';
import { ANOMALY_TRANSITIONED_ACTION } from '../model/dataquality.constants';
import type {
  Anomaly,
  TransitionAnomalyCommand,
} from '../model/dataquality.types';
import { DataQualityLookupService } from './dataquality-lookup.service';

/**
 * Moves an anomaly through its queue lifecycle (UN-705). Acknowledging, resolving,
 * suppressing (with a timed expiry), and reopening are all guarded by the state
 * machine and the optimistic record version. Suppression quiets an alert without
 * erasing the finding — a re-detection reopens it once the suppression expires.
 */
@Injectable()
export class TransitionAnomalyUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    private readonly lookup: DataQualityLookupService,
    private readonly anomalies: AnomalyRepository,
    private readonly audit: AuditRecorderService,
  ) {}

  execute(
    actor: AuthUserIdentity,
    teamId: string,
    anomalyId: string,
    command: TransitionAnomalyCommand,
  ): Promise<Anomaly> {
    return this.unitOfWork.runInTransaction(tx =>
      this.run(tx, actor, teamId, anomalyId, command),
    );
  }

  private async run(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    anomalyId: string,
    command: TransitionAnomalyCommand,
  ): Promise<Anomaly> {
    const existing = await this.lookup.requireAnomaly(tx, teamId, anomalyId);
    const target = anomalyTargetOf(command.transition);
    if (!canTransitionAnomaly(existing.status, target)) {
      throw new AnomalyInvalidTransitionError();
    }
    const changed = await this.anomalies.applyStatusChange(
      tx,
      buildAnomalyStatusChange(
        existing,
        target,
        actor.userId,
        command,
        this.clock.now(),
      ),
    );
    if (changed === null) {
      throw new DataQualityVersionConflictError();
    }
    await this.audit.record(
      tx,
      buildAnomalyAudit(ANOMALY_TRANSITIONED_ACTION, actor.userId, changed),
    );
    return changed;
  }
}
