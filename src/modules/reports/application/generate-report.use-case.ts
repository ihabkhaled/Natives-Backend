import { createHash } from 'node:crypto';

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

import { ReportScopeNotFoundError } from '../errors/report-scope-not-found.error';
import { ReportVersionConflictError } from '../errors/report-version-conflict.error';
import { ReportJobRepository } from '../infrastructure/report-job.repository';
import {
  buildJobAudit,
  buildNewJob,
  buildRequestedAudit,
} from '../lib/reports.builders';
import { privacyOf, requestHash } from '../lib/reports.helpers';
import {
  CHECKSUM_ALGORITHM,
  REPORT_COMPLETED_ACTION,
  REPORT_DOCUMENT_PORT,
} from '../model/reports.constants';
import type {
  GenerateReportCommand,
  RenderedReport,
  ReportDocumentPort,
  ReportJob,
} from '../model/reports.types';
import { ReportDatasetService } from './report-dataset.service';

/**
 * Queues and generates a report asynchronously (UN-701).
 *
 * The whole flow is idempotent by request hash: an identical re-request replays
 * to the EXISTING job instead of regenerating, so a double-click never produces
 * two artifacts. Generation snapshots the data at a fixed instant, renders it
 * through the document adapter (which sanitizes formula injection and strips
 * off-schema fields), stores the checksum, and lands the job in the terminal
 * COMPLETED state — never an endless loading state. There is no large
 * synchronous work on the request thread: the job is small and bounded.
 */
@Injectable()
export class GenerateReportUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR_PORT) private readonly ids: IdGeneratorPort,
    @Inject(REPORT_DOCUMENT_PORT)
    private readonly document: ReportDocumentPort,
    private readonly jobs: ReportJobRepository,
    private readonly datasets: ReportDatasetService,
    private readonly audit: AuditRecorderService,
  ) {}

  execute(
    actor: AuthUserIdentity,
    teamId: string,
    command: GenerateReportCommand,
  ): Promise<ReportJob> {
    return this.unitOfWork.runInTransaction(tx =>
      this.run(tx, actor, teamId, command),
    );
  }

  private async run(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    command: GenerateReportCommand,
  ): Promise<ReportJob> {
    if (!(await this.jobs.activeTeamExists(tx, teamId))) {
      throw new ReportScopeNotFoundError();
    }
    const hash = requestHash(teamId, command.request);
    const existing = await this.jobs.findByRequestHash(tx, teamId, hash);
    if (existing !== null) {
      return existing;
    }
    return this.create(tx, actor, teamId, command, hash);
  }

  private async create(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    command: GenerateReportCommand,
    hash: string,
  ): Promise<ReportJob> {
    const queued = await this.jobs.insert(
      tx,
      buildNewJob(
        this.ids.generate(),
        teamId,
        command.request,
        privacyOf(command.request.template),
        hash,
        actor.userId,
        this.clock.now(),
      ),
    );
    await this.audit.record(tx, buildRequestedAudit(actor.userId, queued));
    return this.generate(tx, actor, queued);
  }

  private async generate(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    queued: ReportJob,
  ): Promise<ReportJob> {
    const running = await this.jobs.markRunning(
      tx,
      queued.teamId,
      queued.jobId,
      this.clock.now(),
    );
    if (running === null) {
      throw new ReportVersionConflictError();
    }
    const rendered = await this.render(tx, running);
    return this.finish(tx, actor, running, rendered);
  }

  private async render(
    tx: TransactionScope,
    job: ReportJob,
  ): Promise<RenderedReport> {
    const columns = this.datasets.columnsFor(job.template);
    const rows = await this.datasets.rowsFor(tx, job);
    return this.document.render({
      template: job.template,
      format: job.format,
      title: this.datasets.titleFor(job.template),
      columns,
      rows,
    });
  }

  private async finish(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    running: ReportJob,
    rendered: RenderedReport,
  ): Promise<ReportJob> {
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
