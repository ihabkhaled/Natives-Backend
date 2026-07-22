import { describe, expect, it, vi } from 'vitest';

import {
  OUTBOX_DISPATCH_INTERVAL_MS,
  OUTBOX_DISPATCH_JOB_KEY,
} from '../model/platform.constants';
import { OutboxDispatchJob } from './outbox-dispatch.job';

function build() {
  const registry = { register: vi.fn(), list: vi.fn() };
  const useCase = { execute: vi.fn().mockResolvedValue(undefined) };
  const job = new OutboxDispatchJob(registry, useCase as never);
  return { job, registry, useCase };
}

describe('OutboxDispatchJob', () => {
  it('declares the dispatcher key and interval', () => {
    const { job } = build();

    expect(job.jobKey).toBe(OUTBOX_DISPATCH_JOB_KEY);
    expect(job.intervalMs).toBe(OUTBOX_DISPATCH_INTERVAL_MS);
  });

  it('registers itself with the job registry on module init', () => {
    const { job, registry } = build();

    job.onModuleInit();

    expect(registry.register).toHaveBeenCalledWith(job);
  });

  it('drains one outbox batch per run', async () => {
    const { job, useCase } = build();

    await job.run();

    expect(useCase.execute).toHaveBeenCalledTimes(1);
  });
});
