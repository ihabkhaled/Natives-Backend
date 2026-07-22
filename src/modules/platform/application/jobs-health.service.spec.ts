import { beforeEach, describe, expect, it, vi } from 'vitest';

import { JobOutcome, JobStatus } from '../model/platform.enums';
import { JobsHealthService } from './jobs-health.service';

const NOW = new Date('2026-07-01T12:00:00.000Z');

const JOBS = [
  { jobKey: 'invitations.expiry', intervalMs: 3_600_000, run: vi.fn() },
  { jobKey: 'outbox.dispatcher', intervalMs: 10_000, run: vi.fn() },
];

function build() {
  const scope = { run: vi.fn() };
  const unitOfWork = {
    runInTransaction: vi.fn(async (op: (s: typeof scope) => Promise<unknown>) =>
      op(scope),
    ),
  };
  const clock = { now: vi.fn().mockReturnValue(NOW), uptime: vi.fn() };
  const registry = { register: vi.fn(), list: vi.fn().mockReturnValue(JOBS) };
  const heartbeats = { listByKeys: vi.fn().mockResolvedValue([]) };
  const service = new JobsHealthService(
    unitOfWork as never,
    clock,
    registry,
    heartbeats as never,
  );
  return { service, registry, heartbeats, scope };
}

describe('JobsHealthService', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('reports every registered job, degraded/never-ran without a heartbeat', async () => {
    const health = await harness.service.read();

    expect(health).toEqual({
      items: [
        {
          jobKey: 'invitations.expiry',
          status: JobStatus.Degraded,
          lastRunAt: null,
          failureCount: 0,
        },
        {
          jobKey: 'outbox.dispatcher',
          status: JobStatus.Degraded,
          lastRunAt: null,
          failureCount: 0,
        },
      ],
    });
    expect(harness.heartbeats.listByKeys).toHaveBeenCalledWith(harness.scope, [
      'invitations.expiry',
      'outbox.dispatcher',
    ]);
  });

  it('derives per-job status from the recorded heartbeat trail', async () => {
    harness.heartbeats.listByKeys.mockResolvedValue([
      {
        jobKey: 'outbox.dispatcher',
        lastRunAt: new Date(NOW.getTime() - 5_000),
        lastOutcome: JobOutcome.Succeeded,
        failureCount: 0,
      },
      {
        jobKey: 'invitations.expiry',
        lastRunAt: new Date(NOW.getTime() - 60_000),
        lastOutcome: JobOutcome.Failed,
        failureCount: 3,
      },
    ]);

    const health = await harness.service.read();

    expect(health.items).toEqual([
      {
        jobKey: 'invitations.expiry',
        status: JobStatus.Failed,
        lastRunAt: new Date(NOW.getTime() - 60_000),
        failureCount: 3,
      },
      {
        jobKey: 'outbox.dispatcher',
        status: JobStatus.Healthy,
        lastRunAt: new Date(NOW.getTime() - 5_000),
        failureCount: 0,
      },
    ]);
  });

  it('reports an empty list when no jobs are registered', async () => {
    harness.registry.list.mockReturnValue([]);

    await expect(harness.service.read()).resolves.toEqual({ items: [] });
  });
});
