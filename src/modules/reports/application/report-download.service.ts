import type { AuthUserIdentity } from '@core/auth';
import { CLOCK_PORT, type ClockPort } from '@core/clock/clock.port';
import {
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { AuditRecorderService } from '@modules/platform';
import { Inject, Injectable } from '@nestjs/common';

import { isDownloadable, isExpired } from '../domain/report-job.state-machine';
import { ReportExpiredError } from '../errors/report-expired.error';
import { ReportNotReadyError } from '../errors/report-not-ready.error';
import { buildJobAudit } from '../lib/reports.builders';
import {
  REPORT_DOWNLOAD_PORT,
  REPORT_DOWNLOADED_ACTION,
} from '../model/reports.constants';
import type {
  DownloadTicket,
  ReportDownloadPort,
  ReportJob,
} from '../model/reports.types';
import { ReportQueryService } from './report-query.service';

/**
 * Mints a short-lived signed download handle for a completed report (UN-701).
 * The artifact is never streamed through the application: only a signed URL,
 * bound to the storage reference and the artifact checksum, is returned — and
 * only while the job is completed and its download window is still open. An
 * expired download is refused so a stale, unverifiable link is never honoured.
 * Every download is audited.
 */
@Injectable()
export class ReportDownloadService {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(REPORT_DOWNLOAD_PORT)
    private readonly download: ReportDownloadPort,
    private readonly lookup: ReportQueryService,
    private readonly audit: AuditRecorderService,
  ) {}

  createTicket(
    actor: AuthUserIdentity,
    teamId: string,
    jobId: string,
  ): Promise<DownloadTicket> {
    return this.unitOfWork.runInTransaction(async tx => {
      const job = await this.lookup.require(tx, teamId, jobId);
      const ticket = this.ticketFor(job);
      await this.audit.record(
        tx,
        buildJobAudit(REPORT_DOWNLOADED_ACTION, actor.userId, job),
      );
      return ticket;
    });
  }

  private ticketFor(job: ReportJob): DownloadTicket {
    const now = this.clock.now();
    if (isExpired(job.status, job.expiresAt, now)) {
      throw new ReportExpiredError();
    }
    if (
      !isDownloadable(job.status, job.expiresAt, now) ||
      job.storageReference === null ||
      job.checksum === null
    ) {
      throw new ReportNotReadyError();
    }
    return this.download.createDownloadTicket({
      storageReference: job.storageReference,
      checksum: job.checksum,
      now,
    });
  }
}
