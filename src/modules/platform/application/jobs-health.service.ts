import { CLOCK_PORT, type ClockPort } from '@core/clock/clock.port';
import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import { resolveJobStatus } from '../domain/job-health.policy';
import { JobHeartbeatRepository } from '../infrastructure/job-heartbeat.repository';
import { SCHEDULED_JOB_PORT } from '../model/platform.constants';
import type {
  JobHealth,
  JobHealthList,
  JobHeartbeat,
  ScheduledJob,
  ScheduledJobRegistryPort,
} from '../model/platform.types';

/**
 * Jobs-health read model: every REGISTERED job joined with its recorded
 * heartbeat trail, status derived by the pure health policy. A job that never
 * ran appears as degraded with a null lastRunAt — recorded runs only, nothing
 * fabricated. Guarded by `jobs.manage` at the route.
 */
@Injectable()
export class JobsHealthService {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(SCHEDULED_JOB_PORT)
    private readonly registry: ScheduledJobRegistryPort,
    private readonly heartbeats: JobHeartbeatRepository,
  ) {}

  read(): Promise<JobHealthList> {
    return this.unitOfWork.runInTransaction(scope => this.load(scope));
  }

  private async load(scope: TransactionScope): Promise<JobHealthList> {
    const jobs = this.registry.list();
    const recorded = await this.heartbeats.listByKeys(
      scope,
      jobs.map(job => job.jobKey),
    );
    const byKey = new Map(recorded.map(entry => [entry.jobKey, entry]));
    const now = this.clock.now();
    return {
      items: jobs.map(job =>
        this.toHealth(job, byKey.get(job.jobKey) ?? null, now),
      ),
    };
  }

  private toHealth(
    job: ScheduledJob,
    heartbeat: JobHeartbeat | null,
    now: Date,
  ): JobHealth {
    return {
      jobKey: job.jobKey,
      status: resolveJobStatus(job.intervalMs, heartbeat, now),
      lastRunAt: heartbeat === null ? null : heartbeat.lastRunAt,
      failureCount: heartbeat === null ? 0 : heartbeat.failureCount,
    };
  }
}
