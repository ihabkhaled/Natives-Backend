import type { AuthUserIdentity } from '@core/auth';
import { CLOCK_PORT, type ClockPort } from '@core/clock/clock.port';
import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import {
  type AuditInput,
  AuditOutcome,
  AuditRecorderService,
} from '@modules/platform';
import { Inject, Injectable } from '@nestjs/common';

import { AssessmentMetricInUseError } from '../errors/assessment-metric-in-use.error';
import { AssessmentMetricNotFoundError } from '../errors/assessment-metric-not-found.error';
import { AssessmentVersionConflictError } from '../errors/assessment-version-conflict.error';
import { AssessmentCatalogRepository } from '../infrastructure/assessment-catalog.repository';
import {
  METRIC_ARCHIVED_ACTION,
  METRIC_RESOURCE_TYPE,
} from '../model/assessments.constants';
import type {
  ArchiveMetricCommand,
  AssessmentMetric,
} from '../model/assessments.types';

/**
 * Archives a team metric definition (soft delete via status). A definition that
 * is already referenced by any template is immutable and cannot be archived — the
 * request is refused with a conflict rather than orphaning pinned versions.
 * Archiving is guarded by an optimistic record version to reject stale writes.
 */
@Injectable()
export class ArchiveMetricUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    private readonly catalog: AssessmentCatalogRepository,
    private readonly audit: AuditRecorderService,
  ) {}

  execute(
    actor: AuthUserIdentity,
    teamId: string,
    metricId: string,
    command: ArchiveMetricCommand,
  ): Promise<AssessmentMetric> {
    return this.unitOfWork.runInTransaction(scope =>
      this.run(scope, actor, teamId, metricId, command),
    );
  }

  private async run(
    scope: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    metricId: string,
    command: ArchiveMetricCommand,
  ): Promise<AssessmentMetric> {
    const current = await this.catalog.findMetricForWrite(
      scope,
      teamId,
      metricId,
    );
    if (current === null) {
      throw new AssessmentMetricNotFoundError();
    }
    if (await this.catalog.metricInUse(scope, metricId)) {
      throw new AssessmentMetricInUseError();
    }
    const archived = await this.catalog.archiveMetric(scope, {
      id: metricId,
      teamId,
      expectedRecordVersion: command.expectedRecordVersion,
      archivedBy: actor.userId,
      now: this.clock.now(),
    });
    if (archived === null) {
      throw new AssessmentVersionConflictError();
    }
    await this.audit.record(scope, this.buildAudit(actor, archived));
    return archived;
  }

  private buildAudit(
    actor: AuthUserIdentity,
    metric: AssessmentMetric,
  ): AuditInput {
    return {
      actorUserId: actor.userId,
      action: METRIC_ARCHIVED_ACTION,
      resourceType: METRIC_RESOURCE_TYPE,
      resourceId: metric.id,
      teamId: metric.teamId,
      seasonId: null,
      correlationId: null,
      outcome: AuditOutcome.Success,
      diff: { key: metric.key, recordVersion: metric.recordVersion },
    };
  }
}
