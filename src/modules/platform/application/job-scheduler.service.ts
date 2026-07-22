import { AppConfigService } from '@config/app-config.service';
import { CLOCK_PORT, type ClockPort } from '@core/clock/clock.port';
import { AppLogger } from '@core/logger';
import {
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import {
  Inject,
  Injectable,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';

import { JobHeartbeatRepository } from '../infrastructure/job-heartbeat.repository';
import {
  JOB_HEARTBEAT_FAILED_LOG,
  JOB_RUN_FAILED_LOG,
  SCHEDULED_JOB_PORT,
} from '../model/platform.constants';
import { JobOutcome } from '../model/platform.enums';
import type {
  ScheduledJob,
  ScheduledJobRegistryPort,
} from '../model/platform.types';

const LOG_PREFIX = 'JobScheduler';

/**
 * The minimal real interval scheduler: one timer per registered job, started on
 * application bootstrap (config-gated via `jobs.enabled`, forced off under
 * test) and cleared on shutdown. Every tick runs the job and records a
 * heartbeat in its OWN transaction — success resets the consecutive-failure
 * count, failure increments it — and no failure (job or heartbeat write) ever
 * crashes the interval: it is logged and the next tick still fires.
 */
@Injectable()
export class JobSchedulerService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly timers: ReturnType<typeof setInterval>[] = [];

  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(SCHEDULED_JOB_PORT)
    private readonly registry: ScheduledJobRegistryPort,
    private readonly config: AppConfigService,
    private readonly heartbeats: JobHeartbeatRepository,
    private readonly logger: AppLogger,
  ) {
    this.logger.setContext(LOG_PREFIX);
  }

  onApplicationBootstrap(): void {
    if (!this.config.jobs.enabled) {
      return;
    }
    for (const job of this.registry.list()) {
      this.timers.push(setInterval(() => void this.tick(job), job.intervalMs));
    }
  }

  onApplicationShutdown(): void {
    for (const timer of this.timers) {
      clearInterval(timer);
    }
    this.timers.length = 0;
  }

  /** One run of one job. Never rejects — the interval must survive anything. */
  async tick(job: ScheduledJob): Promise<void> {
    let outcome = JobOutcome.Succeeded;
    try {
      await job.run();
    } catch {
      outcome = JobOutcome.Failed;
      this.logger.warn(JOB_RUN_FAILED_LOG, { jobKey: job.jobKey });
    }
    await this.recordHeartbeat(job.jobKey, outcome);
  }

  private async recordHeartbeat(
    jobKey: string,
    outcome: JobOutcome,
  ): Promise<void> {
    try {
      await this.unitOfWork.runInTransaction(scope =>
        this.heartbeats.upsert(scope, {
          jobKey,
          outcome,
          now: this.clock.now(),
        }),
      );
    } catch {
      this.logger.warn(JOB_HEARTBEAT_FAILED_LOG, { jobKey });
    }
  }
}
