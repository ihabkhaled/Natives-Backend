import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { JobOutcome } from '../model/platform.enums';
import type { ScheduledJob } from '../model/platform.types';
import { JobSchedulerService } from './job-scheduler.service';

const NOW = new Date('2026-07-01T12:00:00.000Z');

function build(enabled: boolean, jobs: readonly ScheduledJob[]) {
  const scope = { run: vi.fn() };
  const unitOfWork = {
    runInTransaction: vi.fn(async (op: (s: typeof scope) => Promise<unknown>) =>
      op(scope),
    ),
  };
  const clock = { now: vi.fn().mockReturnValue(NOW), uptime: vi.fn() };
  const registry = { register: vi.fn(), list: vi.fn().mockReturnValue(jobs) };
  const config = { jobs: { enabled } };
  const heartbeats = { upsert: vi.fn().mockResolvedValue(undefined) };
  const logger = { setContext: vi.fn(), warn: vi.fn() };
  const service = new JobSchedulerService(
    unitOfWork as never,
    clock,
    registry,
    config as never,
    heartbeats as never,
    logger as never,
  );
  return { service, registry, heartbeats, logger, unitOfWork };
}

function job(jobKey: string, run: () => Promise<void>): ScheduledJob {
  return { jobKey, intervalMs: 10_000, run };
}

describe('JobSchedulerService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts one interval per registered job and drives its run', async () => {
    const run = vi.fn().mockResolvedValue(undefined);
    const harness = build(true, [job('outbox.dispatcher', run)]);

    harness.service.onApplicationBootstrap();
    await vi.advanceTimersByTimeAsync(10_000);
    harness.service.onApplicationShutdown();

    expect(run).toHaveBeenCalledTimes(1);
    expect(harness.heartbeats.upsert).toHaveBeenCalledWith(expect.anything(), {
      jobKey: 'outbox.dispatcher',
      outcome: JobOutcome.Succeeded,
      now: NOW,
    });
  });

  it('stays dormant when jobs are disabled by config', async () => {
    const run = vi.fn().mockResolvedValue(undefined);
    const harness = build(false, [job('outbox.dispatcher', run)]);

    harness.service.onApplicationBootstrap();
    await vi.advanceTimersByTimeAsync(60_000);
    harness.service.onApplicationShutdown();

    expect(run).not.toHaveBeenCalled();
    expect(harness.heartbeats.upsert).not.toHaveBeenCalled();
  });

  it('stops ticking after shutdown clears the intervals', async () => {
    const run = vi.fn().mockResolvedValue(undefined);
    const harness = build(true, [job('outbox.dispatcher', run)]);

    harness.service.onApplicationBootstrap();
    await vi.advanceTimersByTimeAsync(10_000);
    harness.service.onApplicationShutdown();
    await vi.advanceTimersByTimeAsync(50_000);

    expect(run).toHaveBeenCalledTimes(1);
  });

  it('records a failed heartbeat and keeps the interval alive on job failure', async () => {
    const run = vi
      .fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValue(undefined);
    const harness = build(true, [job('invitations.expiry', run)]);

    harness.service.onApplicationBootstrap();
    await vi.advanceTimersByTimeAsync(20_000);
    harness.service.onApplicationShutdown();

    expect(run).toHaveBeenCalledTimes(2);
    expect(harness.heartbeats.upsert).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      expect.objectContaining({ outcome: JobOutcome.Failed }),
    );
    expect(harness.heartbeats.upsert).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      expect.objectContaining({ outcome: JobOutcome.Succeeded }),
    );
    expect(harness.logger.warn).toHaveBeenCalledWith(
      'Scheduled job run failed',
      { jobKey: 'invitations.expiry' },
    );
  });

  it('survives a heartbeat write failure without crashing the tick', async () => {
    const harness = build(true, []);
    harness.heartbeats.upsert.mockRejectedValue(new Error('db down'));

    await expect(
      harness.service.tick(
        job('outbox.dispatcher', vi.fn().mockResolvedValue(undefined)),
      ),
    ).resolves.toBeUndefined();
    expect(harness.logger.warn).toHaveBeenCalledWith(
      'Scheduled job heartbeat write failed',
      { jobKey: 'outbox.dispatcher' },
    );
  });
});
