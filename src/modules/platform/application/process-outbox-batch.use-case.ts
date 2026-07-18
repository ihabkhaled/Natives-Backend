import { CLOCK_PORT, type ClockPort } from '@core/clock/clock.port';
import { AppLogger } from '@core/logger';
import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import { planRetry } from '../domain/outbox-backoff.policy';
import { OutboxRepository } from '../infrastructure/outbox.repository';
import {
  OUTBOX_BATCH_LIMIT,
  OUTBOX_EVENT_HANDLER_PORT,
  OUTBOX_HANDLER_FAILED_LOG,
  OUTBOX_LEASE_MS,
} from '../model/platform.constants';
import type {
  LeasedEvent,
  OutboxBatchResult,
  OutboxEventHandlerPort,
} from '../model/platform.types';

const LOG_PREFIX = 'OutboxWorker';

/**
 * Drains one bounded batch of the transactional outbox. Leases pending (or
 * lease-expired) events with SKIP LOCKED, dispatches each to the handler port,
 * and applies the outcome: completed, rescheduled with capped backoff, or
 * dead-lettered at the attempt ceiling. A failing handler never aborts the batch
 * — each event's outcome is recorded independently in the same transaction.
 */
@Injectable()
export class ProcessOutboxBatchUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(OUTBOX_EVENT_HANDLER_PORT)
    private readonly handler: OutboxEventHandlerPort,
    private readonly outbox: OutboxRepository,
    private readonly logger: AppLogger,
  ) {
    this.logger.setContext(LOG_PREFIX);
  }

  execute(): Promise<OutboxBatchResult> {
    return this.unitOfWork.runInTransaction(scope => this.run(scope));
  }

  private async run(scope: TransactionScope): Promise<OutboxBatchResult> {
    const now = this.clock.now();
    const leaseUntil = new Date(now.getTime() + OUTBOX_LEASE_MS);
    const events = await this.outbox.leaseBatch(
      scope,
      now,
      leaseUntil,
      OUTBOX_BATCH_LIMIT,
    );
    let completed = 0;
    let retried = 0;
    let deadLettered = 0;
    for (const event of events) {
      const result = await this.processOne(scope, event, now);
      completed += result.completed;
      retried += result.retried;
      deadLettered += result.deadLettered;
    }
    return { leased: events.length, completed, retried, deadLettered };
  }

  private async processOne(
    scope: TransactionScope,
    event: LeasedEvent,
    now: Date,
  ): Promise<OutboxBatchResult> {
    try {
      await this.handler.handle(scope, event.envelope);
      await this.outbox.markCompleted(scope, event.envelope.eventId, now);
      return { leased: 1, completed: 1, retried: 0, deadLettered: 0 };
    } catch (error) {
      return this.onFailure(scope, event, now, error);
    }
  }

  private async onFailure(
    scope: TransactionScope,
    event: LeasedEvent,
    now: Date,
    error: unknown,
  ): Promise<OutboxBatchResult> {
    const message = error instanceof Error ? error.message : String(error);
    const plan = planRetry(event.attempts, now);
    this.logger.warn(OUTBOX_HANDLER_FAILED_LOG, {
      eventId: event.envelope.eventId,
      attempts: event.attempts,
      deadLettered: plan.deadLettered,
    });
    const id = event.envelope.eventId;
    if (plan.deadLettered) {
      await this.outbox.deadLetter(scope, id, message, now);
      return { leased: 1, completed: 0, retried: 0, deadLettered: 1 };
    }
    await this.outbox.reschedule(scope, id, plan.availableAt, message);
    return { leased: 1, completed: 0, retried: 1, deadLettered: 0 };
  }
}
