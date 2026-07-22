import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import { OutboxRepository } from '../infrastructure/outbox.repository';
import type {
  DeadLetter,
  PagedResult,
  PageRequest,
} from '../model/platform.types';

/**
 * Operational read of the dead-letter queue behind the metrics counters: a
 * bounded, deterministically ordered page carrying stable failure codes only —
 * never payloads or raw error text. Guarded by `jobs.manage` at the route; the
 * existing audited replay endpoint is the requeue path.
 */
@Injectable()
export class DeadLetterQueryService {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    private readonly outbox: OutboxRepository,
  ) {}

  list(page: PageRequest): Promise<PagedResult<DeadLetter>> {
    return this.unitOfWork.runInTransaction(scope => this.load(scope, page));
  }

  private async load(
    scope: TransactionScope,
    page: PageRequest,
  ): Promise<PagedResult<DeadLetter>> {
    const items = await this.outbox.listDeadLetters(scope, page);
    const total = await this.outbox.countDeadLetters(scope);
    return { items, total, limit: page.limit, offset: page.offset };
  }
}
