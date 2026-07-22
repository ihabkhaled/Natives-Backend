import { describe, expect, it } from 'vitest';

import { JobOutcome, JobStatus } from '../model/platform.enums';
import type { JobHeartbeat } from '../model/platform.types';
import { resolveJobStatus } from './job-health.policy';

const NOW = new Date('2026-07-01T12:00:00.000Z');
const INTERVAL_MS = 10_000;

function heartbeat(overrides: Partial<JobHeartbeat>): JobHeartbeat {
  return {
    jobKey: 'outbox.dispatcher',
    lastRunAt: NOW,
    lastOutcome: JobOutcome.Succeeded,
    failureCount: 0,
    ...overrides,
  };
}

describe('resolveJobStatus', () => {
  it('is degraded when the job never ran (no heartbeat row)', () => {
    expect(resolveJobStatus(INTERVAL_MS, null, NOW)).toBe(JobStatus.Degraded);
  });

  it('is failed when the newest run failed', () => {
    expect(
      resolveJobStatus(
        INTERVAL_MS,
        heartbeat({ lastOutcome: JobOutcome.Failed, failureCount: 2 }),
        NOW,
      ),
    ).toBe(JobStatus.Failed);
  });

  it('is degraded when the newest run is older than the stall window', () => {
    const stale = new Date(NOW.getTime() - 3 * INTERVAL_MS - 1);

    expect(
      resolveJobStatus(INTERVAL_MS, heartbeat({ lastRunAt: stale }), NOW),
    ).toBe(JobStatus.Degraded);
  });

  it('is healthy exactly at the stall boundary', () => {
    const boundary = new Date(NOW.getTime() - 3 * INTERVAL_MS);

    expect(
      resolveJobStatus(INTERVAL_MS, heartbeat({ lastRunAt: boundary }), NOW),
    ).toBe(JobStatus.Healthy);
  });

  it('is degraded when a success trail still carries consecutive failures', () => {
    expect(
      resolveJobStatus(INTERVAL_MS, heartbeat({ failureCount: 1 }), NOW),
    ).toBe(JobStatus.Degraded);
  });

  it('is healthy for a fresh, successful, failure-free heartbeat', () => {
    expect(resolveJobStatus(INTERVAL_MS, heartbeat({}), NOW)).toBe(
      JobStatus.Healthy,
    );
  });
});
