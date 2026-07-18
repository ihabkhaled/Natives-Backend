import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import { OutboxRepository } from '../infrastructure/outbox.repository';
import { toOutboxMetrics } from '../lib/platform.mapper';
import type { OutboxMetrics } from '../model/platform.types';

/**
 * Operational read of outbox health: pending/processing/completed/dead-lettered
 * counts for dashboards and alerts. Guarded by `jobs.manage`.
 */
@Injectable()
export class OutboxMetricsService {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    private readonly outbox: OutboxRepository,
  ) {}

  read(): Promise<OutboxMetrics> {
    return this.unitOfWork.runInTransaction(scope => this.load(scope));
  }

  private async load(scope: TransactionScope): Promise<OutboxMetrics> {
    return toOutboxMetrics(await this.outbox.metrics(scope));
  }
}
