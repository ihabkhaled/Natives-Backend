import { JOB_STALL_FACTOR } from '../model/platform.constants';
import { JobOutcome, JobStatus } from '../model/platform.enums';
import type { JobHeartbeat } from '../model/platform.types';

/**
 * Pure status policy for one scheduled job, derived from recorded heartbeats
 * only — never fabricated:
 *
 * - `failed`   — the newest recorded run failed;
 * - `degraded` — the job never ran, its newest run is older than
 *                JOB_STALL_FACTOR x its interval (stalled scheduler), or the
 *                consecutive-failure trail is non-zero despite a last success;
 * - `healthy`  — a fresh, successful, failure-free heartbeat.
 */
export function resolveJobStatus(
  intervalMs: number,
  heartbeat: JobHeartbeat | null,
  now: Date,
): JobStatus {
  if (heartbeat === null) {
    return JobStatus.Degraded;
  }
  if (heartbeat.lastOutcome === JobOutcome.Failed) {
    return JobStatus.Failed;
  }
  const staleAfterMs = JOB_STALL_FACTOR * intervalMs;
  if (now.getTime() - heartbeat.lastRunAt.getTime() > staleAfterMs) {
    return JobStatus.Degraded;
  }
  if (heartbeat.failureCount > 0) {
    return JobStatus.Degraded;
  }
  return JobStatus.Healthy;
}
