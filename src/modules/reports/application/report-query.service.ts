import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import { ReportJobNotFoundError } from '../errors/report-job-not-found.error';
import { ReportJobRepository } from '../infrastructure/report-job.repository';
import type {
  PageRequest,
  ReportJob,
  ReportJobPage,
  ReportListFilter,
} from '../model/reports.types';

/** Read side of report jobs: a bounded page and one job (a miss is a 404). */
@Injectable()
export class ReportQueryService {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    private readonly repository: ReportJobRepository,
  ) {}

  listForScope(
    teamId: string,
    filter: ReportListFilter,
    page: PageRequest,
  ): Promise<ReportJobPage> {
    return this.unitOfWork.runInTransaction(tx =>
      this.page(tx, teamId, filter, page),
    );
  }

  getById(teamId: string, jobId: string): Promise<ReportJob> {
    return this.unitOfWork.runInTransaction(tx =>
      this.require(tx, teamId, jobId),
    );
  }

  async require(
    tx: TransactionScope,
    teamId: string,
    jobId: string,
  ): Promise<ReportJob> {
    const job = await this.repository.findForWrite(tx, teamId, jobId);
    if (job === null) {
      throw new ReportJobNotFoundError();
    }
    return job;
  }

  private async page(
    tx: TransactionScope,
    teamId: string,
    filter: ReportListFilter,
    page: PageRequest,
  ): Promise<ReportJobPage> {
    const items = await this.repository.listForScope(tx, teamId, filter, page);
    const total = await this.repository.countForScope(tx, teamId, filter);
    return { items, total, limit: page.limit, offset: page.offset };
  }
}
