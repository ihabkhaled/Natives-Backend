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

import { countAlertable } from '../domain/anomaly-alert.policy';
import { DataQualityScopeNotFoundError } from '../errors/data-quality-scope-not-found.error';
import { AnomalyRepository } from '../infrastructure/anomaly.repository';
import { DetectionRepository } from '../infrastructure/detection.repository';
import {
  buildAnomalyUpsert,
  buildScanAudit,
} from '../lib/dataquality.builders';
import { severityOf } from '../lib/dataquality.helpers';
import {
  MILLISECONDS_PER_HOUR,
  RULE_VERSION,
  SCAN_COMPLETED_ACTION,
  SCAN_RULE_COUNT,
  STALE_PROJECTION_HOURS,
} from '../model/dataquality.constants';
import { AnomalyStatus } from '../model/dataquality.enums';
import type {
  Anomaly,
  DetectedAnomaly,
  ScanCommand,
  ScanReport,
} from '../model/dataquality.types';

/**
 * Runs a read-only data-quality scan and folds its findings into the queue
 * (UN-705).
 *
 * Detection is strictly read-only — nothing here mutates data. Each finding is
 * upserted by fingerprint, so re-running the scan bumps an existing anomaly and
 * REOPENS a resolved-but-recurring one rather than duplicating it. Only the
 * actionable severities count toward the alertable total, so an `info` finding
 * sits in the queue without paging anyone.
 */
@Injectable()
export class ScanUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR_PORT) private readonly ids: IdGeneratorPort,
    private readonly detection: DetectionRepository,
    private readonly anomalies: AnomalyRepository,
    private readonly audit: AuditRecorderService,
  ) {}

  execute(
    actor: AuthUserIdentity,
    teamId: string,
    command: ScanCommand,
  ): Promise<ScanReport> {
    return this.unitOfWork.runInTransaction(tx =>
      this.run(tx, actor, teamId, command),
    );
  }

  private async run(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    command: ScanCommand,
  ): Promise<ScanReport> {
    if (!(await this.detection.activeTeamExists(tx, teamId))) {
      throw new DataQualityScopeNotFoundError();
    }
    const detected = await this.detect(tx, teamId);
    const upserted = await this.foldFindings(tx, teamId, detected);
    return this.finish(tx, actor, teamId, detected, upserted, command);
  }

  private async detect(
    tx: TransactionScope,
    teamId: string,
  ): Promise<readonly DetectedAnomaly[]> {
    const staleBefore = new Date(
      this.clock.now().getTime() -
        STALE_PROJECTION_HOURS * MILLISECONDS_PER_HOUR,
    );
    const jersey = await this.detection.detectJerseyConflicts(tx, teamId);
    const orphan = await this.detection.detectOrphanPoints(tx, teamId);
    const stale = await this.detection.detectStaleProjections(
      tx,
      teamId,
      staleBefore,
    );
    return [...jersey, ...orphan, ...stale];
  }

  private async foldFindings(
    tx: TransactionScope,
    teamId: string,
    detected: readonly DetectedAnomaly[],
  ): Promise<readonly Anomaly[]> {
    const upserted: Anomaly[] = [];
    for (const finding of detected) {
      upserted.push(
        await this.anomalies.upsert(
          tx,
          buildAnomalyUpsert(
            this.ids.generate(),
            teamId,
            finding,
            this.clock.now(),
          ),
        ),
      );
    }
    return upserted;
  }

  private async finish(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    detected: readonly DetectedAnomaly[],
    upserted: readonly Anomaly[],
    command: ScanCommand,
  ): Promise<ScanReport> {
    const report: ScanReport = {
      ruleVersion: RULE_VERSION,
      rulesRun: command.rules === null ? SCAN_RULE_COUNT : command.rules.length,
      detected: detected.length,
      opened: upserted.filter(anomaly => anomaly.occurrenceCount === 1).length,
      reopened: upserted.filter(
        anomaly =>
          anomaly.occurrenceCount > 1 && anomaly.status === AnomalyStatus.Open,
      ).length,
      alertable: countAlertable(detected, severityOf),
    };
    await this.audit.record(
      tx,
      buildScanAudit(SCAN_COMPLETED_ACTION, actor.userId, teamId, report),
    );
    return report;
  }
}
