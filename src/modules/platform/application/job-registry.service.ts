import { Injectable } from '@nestjs/common';

import type {
  ScheduledJob,
  ScheduledJobRegistryPort,
} from '../model/platform.types';

/**
 * The scheduled-job registry behind `SCHEDULED_JOB_PORT`. Modules register
 * their jobs during Nest initialization (platform registers the outbox
 * dispatcher; identity registers invitation expiry) and both the interval
 * scheduler and the jobs-health read consume the same list, so what is
 * scheduled and what is reported can never diverge. Duplicate keys are
 * rejected fail-fast — two jobs sharing a key would corrupt the heartbeat
 * trail silently.
 */
@Injectable()
export class JobRegistryService implements ScheduledJobRegistryPort {
  private readonly jobs = new Map<string, ScheduledJob>();

  register(job: ScheduledJob): void {
    if (this.jobs.has(job.jobKey)) {
      throw new Error(`Duplicate scheduled job key: ${job.jobKey}`);
    }
    this.jobs.set(job.jobKey, job);
  }

  list(): readonly ScheduledJob[] {
    return [...this.jobs.values()].sort((first, second) =>
      first.jobKey.localeCompare(second.jobKey),
    );
  }
}
