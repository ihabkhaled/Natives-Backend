import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';

import { ProcessOutboxBatchUseCase } from '../application/process-outbox-batch.use-case';
import {
  OUTBOX_DISPATCH_INTERVAL_MS,
  OUTBOX_DISPATCH_JOB_KEY,
  SCHEDULED_JOB_PORT,
} from '../model/platform.constants';
import type {
  ScheduledJob,
  ScheduledJobRegistryPort,
} from '../model/platform.types';

/**
 * The platform's own scheduled job: drain one bounded outbox batch per tick.
 * Registers itself with the job registry on module init, so the scheduler
 * drives it and the health endpoint reports it — the previously latent worker
 * actually runs.
 */
@Injectable()
export class OutboxDispatchJob implements ScheduledJob, OnModuleInit {
  readonly jobKey = OUTBOX_DISPATCH_JOB_KEY;
  readonly intervalMs = OUTBOX_DISPATCH_INTERVAL_MS;

  constructor(
    @Inject(SCHEDULED_JOB_PORT)
    private readonly registry: ScheduledJobRegistryPort,
    private readonly processOutboxBatch: ProcessOutboxBatchUseCase,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  async run(): Promise<void> {
    await this.processOutboxBatch.execute();
  }
}
