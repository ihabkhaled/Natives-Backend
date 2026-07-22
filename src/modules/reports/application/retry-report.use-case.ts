import { createHash } from 'node:crypto';

import type { AuthUserIdentity } from '@core/auth';
import { CLOCK_PORT, type ClockPort } from '@core/clock/clock.port';
import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { AuditRecorderService } from '@modules/platform';
import { Inject, Injectable } from '@nestjs/common';

import { canRetry } from '../domain/report-job.state-machine';
import { ReportRetryNotAllowedError } from '../errors/report-retry-not-allowed.error';
import { ReportVersionConflictError } from '../errors/report-version-conflict.error';
import { ReportJobRepository } from '../infrastructure/report-job.repository';
import { buildJobAudit } from '../lib/reports.builders';
import {
  CHECKSUM_ALGORITHM,
  REPORT_COMPLETED_ACTION,
  REPORT_DOCUMENT_PORT,
  REPORT_RETRIED_ACTION,
} from '../model/reports.constants';
import type { ReportDocumentPort, ReportJob } from '../model/reports.types';
import { ReportDatasetService } from './report-dataset.service';
import { ReportQueryService } from './report-query.service';

/**
 * Retries a FAILED report job while retries remain (UN-701). The retry increments
 * the attempt count, re-runs the same bounded generation, and lands the job in
 * the terminal COMPLETED state — so a transient failure is recoverable without
 * requesting a whole new report, and a job that has exhausted its retries is
 * refused rather than looping forever.
 */
@Injectable()
export class RetryReportUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(REPORT_DOCUMENT_PORT)
    private readonly document: ReportDocumentPort,
    private readonly lookup: ReportQueryService,
    private readonly jobs: ReportJobRepository,
    private readonly datasets: ReportDatasetService,
    private readonly audit: AuditRecorderService,
  ) {}

  execute(
    actor: AuthUserIdentity,
    teamId: string,
    jobId: string,
  ): Promise<ReportJob> {
    return this.unitOfWork.runInTransaction(tx =>
      this.run(tx, actor, teamId, jobId),
    );
  }

  private async run(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    jobId: string,
  ): Promise<ReportJob> {
    const existing = await this.lookup.require(tx, teamId, jobId);
    if (!canRetry(existing.status, existing.retryCount)) {
      throw new ReportRetryNotAllowedError();
    }
    const running = await this.jobs.incrementRetry(
      tx,
      teamId,
      jobId,
      this.clock.now(),
    );
    if (running === null) {
      throw new ReportVersionConflictError();
    }
    await this.audit.record(
      tx,
      buildJobAudit(REPORT_RETRIED_ACTION, actor.userId, running),
    );
    return this.regenerate(tx, actor, running);
  }

  private async regenerate(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    running: ReportJob,
  ): Promise<ReportJob> {
    const columns = this.datasets.columnsFor(running.template);
    const rows = await this.datasets.rowsFor(tx, running);
    const rendered = this.document.render({
      template: running.template,
      format: running.format,
      title: this.datasets.titleFor(running.template),
      columns,
      rows,
    });
    const checksum = createHash(CHECKSUM_ALGORITHM)
      .update(rendered.content)
      .digest('hex');
    const completed = await this.jobs.complete(tx, {
      id: running.jobId,
      teamId: running.teamId,
      expectedRecordVersion: running.recordVersion,
      storageReference: `reports/${running.teamId}/${running.jobId}.${rendered.format}`,
      checksum,
      rowCount: rendered.rowCount,
      now: this.clock.now(),
    });
    if (completed === null) {
      throw new ReportVersionConflictError();
    }
    await this.audit.record(
      tx,
      buildJobAudit(REPORT_COMPLETED_ACTION, actor.userId, completed),
    );
    return completed;
  }
}
